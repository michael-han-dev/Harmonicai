import os
from typing import Iterable, List, Optional

import redis
from celery import states
from celery.utils.log import get_task_logger

from backend.celery_app import celery_app
from backend.db import database


logger = get_task_logger(__name__)


def _get_redis_client() -> redis.Redis:
    redis_url = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
    return redis.Redis.from_url(redis_url, decode_responses=True)


def _acquire_collection_lock(r: redis.Redis, collection_id: str, task_id: str, ttl_seconds: int = 3600) -> bool:
    key = f"collection:{collection_id}:lock"
    # NX: only set if not exists; EX: expire in ttl seconds
    return bool(r.set(key, task_id, nx=True, ex=ttl_seconds))


def _release_collection_lock(r: redis.Redis, collection_id: str, task_id: str) -> None:
    key = f"collection:{collection_id}:lock"
    current = r.get(key)
    if current == task_id:
        r.delete(key)


def _is_cancel_requested(r: redis.Redis, task_id: str) -> bool:
    return r.get(f"operation:{task_id}:cancel") == "1"


def _set_cancel_requested(r: redis.Redis, task_id: str) -> None:
    r.set(f"operation:{task_id}:cancel", "1")


def _get_active_interactive_task_id(r: redis.Redis) -> Optional[str]:
    return r.get("interactive:active")


def _is_interactive_task_active(r: redis.Redis) -> bool:
    """Check if any interactive queue task is currently running"""
    return r.exists("interactive:active") > 0


def _set_interactive_task_active(r: redis.Redis, task_id: str) -> None:
    """Mark an interactive task as active"""
    r.set("interactive:active", task_id, ex=3600)  # Expire after 1 hour as safety


def _clear_interactive_task_active(r: redis.Redis, task_id: str) -> None:
    """Clear interactive task marker if this task set it"""
    current = r.get("interactive:active")
    if current == task_id:
        r.delete("interactive:active")


def _store_inserted_ids(r: redis.Redis, task_id: str, company_ids: Iterable[int]) -> None:
    if not company_ids:
        return
    key = f"operation:{task_id}:inserted_ids"
    # Use a Redis Set to avoid duplicates and enable fast membership testing
    r.sadd(key, *list(company_ids))


def _fetch_inserted_ids(r: redis.Redis, task_id: str) -> List[int]:
    key = f"operation:{task_id}:inserted_ids"
    members = r.smembers(key)
    return [int(x) for x in members]


def _clear_operation_state(r: redis.Redis, task_id: str) -> None:
    r.delete(f"operation:{task_id}:inserted_ids")
    r.delete(f"operation:{task_id}:cancel")


def _compute_delta_ids(
    db: database.SessionLocal, source_collection_id: str, target_collection_id: str, selected_ids: Optional[List[int]]
) -> List[int]:
    import uuid
    source_uuid = uuid.UUID(source_collection_id)
    target_uuid = uuid.UUID(target_collection_id)
    
    source_q = (
        db.query(database.CompanyCollectionAssociation.company_id)
        .filter(database.CompanyCollectionAssociation.collection_id == source_uuid)
    )
    if selected_ids is not None:
        if not selected_ids:
            return []
        source_q = source_q.filter(database.CompanyCollectionAssociation.company_id.in_(selected_ids))
    source_ids = {cid for (cid,) in source_q.all()}

    target_ids = {
        cid
        for (cid,)
        in db.query(database.CompanyCollectionAssociation.company_id)
        .filter(database.CompanyCollectionAssociation.collection_id == target_uuid)
        .all()
    }

    delta_ids = list(source_ids - target_ids)
    return delta_ids


@celery_app.task(bind=True, name="bulk_add_companies", queue="bulk")
def bulk_add_companies(self, source_collection_id: str, target_collection_id: str, mode: str, company_ids: Optional[List[int]] = None):
    r = _get_redis_client()
    task_id = self.request.id
    acquired = False
    try:
        acquired = _acquire_collection_lock(r, target_collection_id, task_id, ttl_seconds=24 * 3600)
        if not acquired:
            meta = {"status": "failed", "message": "Another bulk operation is already writing to the target collection."}
            self.update_state(state=states.FAILURE, meta=meta)
            return meta

        db_session = database.SessionLocal()
        try:
            selected = None if mode == "all" else (company_ids or [])
            delta_ids = _compute_delta_ids(db_session, source_collection_id, target_collection_id, selected)

            total = len(delta_ids)
            self.update_state(state=states.STARTED, meta={"status": "starting", "current": 0, "total": total})

            inserted_count = 0
            batch_size = 50
            batch: List[database.CompanyCollectionAssociation] = []

            # Convert string UUID to UUID object for database operations
            import uuid
            target_uuid = uuid.UUID(target_collection_id)

            for idx, company_id in enumerate(delta_ids, start=1):
                if _is_cancel_requested(r, task_id):
                    self.update_state(
                        state=states.REVOKED,
                        meta={"status": "cancelled", "current": inserted_count, "total": total},
                    )
                    return {"status": "cancelled", "inserted": inserted_count, "total": total}

                if _is_interactive_task_active(r):
                    self.update_state(
                        state=states.STARTED,
                        meta={"status": "paused", "current": inserted_count, "total": total, "message": "Paused for interactive task"}
                    )
                    import time
                    while _is_interactive_task_active(r) and not _is_cancel_requested(r, task_id):
                        time.sleep(1)
                    if _is_cancel_requested(r, task_id):
                        self.update_state(
                            state=states.REVOKED,
                            meta={"status": "cancelled", "current": inserted_count, "total": total},
                        )
                        return {"status": "cancelled", "inserted": inserted_count, "total": total}
                    self.update_state(
                        state=states.STARTED,
                        meta={"status": "resumed", "current": inserted_count, "total": total, "message": "Resuming after interactive task"}
                    )

                association = database.CompanyCollectionAssociation(
                    company_id=company_id, collection_id=target_uuid
                )
                batch.append(association)

                if len(batch) >= batch_size or idx == total:
                    for assoc in batch:
                        db_session.add(assoc)
                        db_session.flush()
                        inserted_count += 1
                    db_session.commit()

                    # Track inserted company IDs for undo functionality
                    _store_inserted_ids(r, task_id, [a.company_id for a in batch])

                    percent = (inserted_count / total) * 100 if total else 100.0
                    remaining = max(total - inserted_count, 0)
                    eta_seconds = remaining * 0.1
                    self.update_state(
                        state=states.STARTED,
                        meta={
                            "status": "in_progress",
                            "current": inserted_count,
                            "total": total,
                            "percent": percent,
                            "eta_seconds": eta_seconds,
                        },
                    )

                    batch.clear()

            if _is_cancel_requested(r, task_id):
                self.update_state(
                    state=states.REVOKED,
                    meta={"status": "cancelled", "current": inserted_count, "total": total},
                )
                return {"status": "cancelled", "inserted": inserted_count, "total": total}
            else:
                self.update_state(
                    state=states.SUCCESS,
                    meta={"status": "completed", "current": inserted_count, "total": total, "percent": 100.0, "eta_seconds": 0},
                )
                return {"status": "completed", "inserted": inserted_count, "total": total}
        finally:
            db_session.close()
    except Exception as exc: 
        logger.exception("bulk_add_companies failed: %s", exc)
        self.update_state(state=states.FAILURE, meta={"status": "failed", "message": str(exc)})
        raise
    finally:
        if acquired:
            _release_collection_lock(r, target_collection_id, task_id)


@celery_app.task(bind=True, name="undo_bulk_add", queue="interactive")
def undo_bulk_add(self, target_collection_id: str, task_id_to_undo: str):
    r = _get_redis_client()
    task_id = self.request.id
    
    _set_interactive_task_active(r, task_id)
    
    db_session = database.SessionLocal()
    try:
        self.update_state(state=states.STARTED, meta={"status": "starting", "current": 0, "total": 0})
        
        inserted_ids = _fetch_inserted_ids(r, task_id_to_undo)
        if not inserted_ids:
            self.update_state(state=states.SUCCESS, meta={"status": "completed", "deleted": 0})
            return {"status": "completed", "deleted": 0}

        # Convert string UUID to UUID object for database query
        import uuid
        collection_uuid = uuid.UUID(target_collection_id)
        
        deleted_count = (
            db_session.query(database.CompanyCollectionAssociation)
            .filter(database.CompanyCollectionAssociation.collection_id == collection_uuid)
            .filter(database.CompanyCollectionAssociation.company_id.in_(inserted_ids))
            .delete(synchronize_session=False)
        )
        db_session.commit()

        _clear_operation_state(r, task_id_to_undo)

        self.update_state(state=states.SUCCESS, meta={"status": "completed", "deleted": deleted_count})
        return {"status": "completed", "deleted": deleted_count}
    except Exception as exc:
        logger.exception("undo_bulk_add failed: %s", exc)
        self.update_state(state=states.FAILURE, meta={"status": "failed", "message": str(exc)})
        raise
    finally:
        db_session.close()
        _clear_interactive_task_active(r, task_id)


@celery_app.task(bind=True, name="interactive_operation")
def interactive_operation(self, operation_type: str, **kwargs):
    """Generic wrapper for interactive operations that need to pause bulk tasks"""
    r = _get_redis_client()
    task_id = self.request.id
    
    # Mark this interactive task as active to pause bulk operations
    _set_interactive_task_active(r, task_id)
    
    try:
        self.update_state(state=states.STARTED, meta={"status": "running", "operation": operation_type})
        
        # Simulate the actual work here - replace with real operations
        if operation_type == "delete_companies":
            # Example: delete companies from collection
            import time
            time.sleep(2)  # Simulate work
            result = {"status": "completed", "deleted": kwargs.get("count", 0)}
        else:
            result = {"status": "completed", "message": f"{operation_type} completed"}
            
        self.update_state(state=states.SUCCESS, meta=result)
        return result
    except Exception as exc:
        logger.exception("interactive_operation failed: %s", exc)
        self.update_state(state=states.FAILURE, meta={"status": "failed", "message": str(exc)})
        raise
    finally:
        # Always clear interactive task marker
        _clear_interactive_task_active(r, task_id)

