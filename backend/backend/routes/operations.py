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
    
    # Route to appropriate queue: >2000 items = bulk queue, ≤2000 = interactive queue
    queue_name = "bulk" if total_items > 2000 else "interactive"
    
    async_result = bulk_add_companies.apply_async(
        args=[str(source_id), str(target_id), mode, company_ids], 
        queue=queue_name
    )
    return BatchResponse(task_id=async_result.id)


@router.get("/operations/{task_id}/status")
def get_operation_status(task_id: str):
    result = celery_app.AsyncResult(task_id)
    meta = result.info if isinstance(result.info, dict) else {}
    return {
        "task_id": task_id,
        "state": result.state,
        "status": meta.get("status", result.state.lower()),
        "current": meta.get("current", 0),
        "total": meta.get("total", 0),
        "percent": meta.get("percent"),
        "eta_seconds": meta.get("eta_seconds"),
        "message": meta.get("message"),
    }


@router.post("/operations/{task_id}/cancel")
def cancel_operation(task_id: str):
    r = _get_redis_client()
    r.set(f"operation:{task_id}:cancel", "1")
    # Also revoke queued tasks so they don't start
    celery_app.control.revoke(task_id)
    return {"status": "cancelling"}


@router.post("/operations/{task_id}/undo")
def undo_operation(task_id: str, payload: UndoRequest):
    async_result = undo_bulk_add.apply_async(args=[str(payload.target_collection_id), task_id], queue="interactive")
    return {"undo_task_id": async_result.id}

