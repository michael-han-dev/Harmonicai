import os
import uuid
from typing import Optional

import redis
from celery import states
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.celery_app import celery_app
from backend.db import database
from backend.tasks import bulk_add_companies, undo_bulk_add  # type: ignore


router = APIRouter(tags=["operations"])


class BatchRequest(BaseModel):
    mode: str
    companyIds: Optional[list[int]] = None

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("all", "selected"):
            raise ValueError("mode must be 'all' or 'selected'")
        return v


class BatchResponse(BaseModel):
    task_id: str


class UndoRequest(BaseModel):
    target_collection_id: uuid.UUID


def _get_redis_client() -> redis.Redis:
    redis_url = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
    return redis.Redis.from_url(redis_url, decode_responses=True)

# Start a background task to add companies from one collection to another.
@router.post("/collections/{source_id}/to/{target_id}/companies/batch", response_model=BatchResponse)
def start_bulk_add(
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    payload: BatchRequest,
    db: Session = Depends(database.get_db),
):
    mode = payload.mode
    company_ids = payload.companyIds or []
    if mode == "selected" and not company_ids:
        raise HTTPException(status_code=400, detail="companyIds required when mode is 'selected'")

    # Determine queue based on estimated work size
    from backend.tasks import _compute_delta_ids
    selected = None if mode == "all" else company_ids
    delta_ids = _compute_delta_ids(db, str(source_id), str(target_id), selected)
    total_items = len(delta_ids)
    
    # Route to appropriate queue: >500 items = bulk queue, ≤500 = interactive queue
    queue_name = "bulk" if total_items > 500 else "interactive"
    
    async_result = bulk_add_companies.apply_async(
        args=[str(source_id), str(target_id), mode, company_ids if mode == "selected" else None],
        queue=queue_name,
    )
    return BatchResponse(task_id=async_result.id)

# Get the current status/progress of a background task.
@router.get("/operations/{task_id}/status")
def get_operation_status(task_id: str):
    result = celery_app.AsyncResult(task_id)
    # Celery can raise while decoding backend payloads (e.g., revoked/failure without exc_type)
    try:
        info = result.info
    except Exception:  # noqa: BLE001
        info = None
    meta = info if isinstance(info, dict) else {}
    try:
        state = result.state
    except Exception:  # noqa: BLE001
        state = "UNKNOWN"
    return {
        "task_id": task_id,
        "state": state,
        "status": meta.get("status", state.lower() if isinstance(state, str) else "unknown"),
        "current": meta.get("current", 0),
        "total": meta.get("total", 0),
        "percent": meta.get("percent"),
        "eta_seconds": meta.get("eta_seconds"),
        "message": meta.get("message"),
    }

# Request graceful cancellation of a running background task.
@router.post("/operations/{task_id}/cancel")
def cancel_operation(task_id: str):
    r = _get_redis_client()
    r.set(f"operation:{task_id}:cancel", "1")
    # Revoke with terminate=False (graceful); if a worker is processing, it will observe the flag in-task
    celery_app.control.revoke(task_id, terminate=False)
    return {"status": "cancelling"}

# Trigger a fast undo of a previous bulk add by deleting inserted rows.
@router.post("/operations/{task_id}/undo")
def undo_operation(task_id: str, payload: UndoRequest):
    async_result = undo_bulk_add.apply_async(args=[str(payload.target_collection_id), task_id], queue="interactive")
    return {"undo_task_id": async_result.id}

