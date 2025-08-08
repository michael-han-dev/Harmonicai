import uuid

from fastapi import APIRouter, Depends, Query, HTTPException, status
import os
import redis
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.db import database
from backend.routes.companies import (
    CompanyBatchOutput,
    fetch_companies_with_liked,
)

router = APIRouter(
    prefix="/collections",
    tags=["collections"],
)


class CompanyCollectionMetadata(BaseModel):
    id: uuid.UUID
    collection_name: str
    count: Optional[int] = 0


class CompanyCollectionOutput(CompanyBatchOutput, CompanyCollectionMetadata):
    pass

# List all collection records (id and name only).
@router.get("", response_model=list[CompanyCollectionMetadata])
def get_all_collection_metadata(
    db: Session = Depends(database.get_db),
):
    collections = db.query(database.CompanyCollection).all()

    # Pre-compute counts for all collections in one query
    counts = {
        cid: int(cnt)
        for cid, cnt in (
            db.query(
                database.CompanyCollectionAssociation.collection_id,
                func.count(),
            )
            .group_by(database.CompanyCollectionAssociation.collection_id)
            .all()
        )
    }

    return [
        CompanyCollectionMetadata(
            id=collection.id,
            collection_name=collection.collection_name,
            count=counts.get(collection.id, 0),
        )
        for collection in collections
    ]


class CreateCollectionRequest(BaseModel):
    collection_name: str

# Create a new collection and return its metadata.
@router.post("", response_model=CompanyCollectionMetadata)
def create_collection(payload: CreateCollectionRequest, db: Session = Depends(database.get_db)):
    new_collection = database.CompanyCollection(collection_name=payload.collection_name)
    db.add(new_collection)
    db.commit()
    db.refresh(new_collection)
    return CompanyCollectionMetadata(id=new_collection.id, collection_name=new_collection.collection_name, count=0)

# Get a paginated list of companies within a collection with counts.
@router.get("/{collection_id}", response_model=CompanyCollectionOutput)
def get_company_collection_by_id(
    collection_id: uuid.UUID,
    offset: int = Query(0, description="The number of items to skip from the beginning"),
    limit: int = Query(10, description="The number of items to fetch"),
    search: Optional[str] = Query(None, description="Case-insensitive company name search"),
    industries: Optional[List[str]] = Query(None),
    funding: Optional[List[str]] = Query(None),
    sizeRanges: Optional[List[str]] = Query(None, description="Team size ranges like 0-10,11-50,51-200,201-500,500+"),
    liked_only: bool = Query(False, description="Only companies in 'Liked Companies List'"),
    db: Session = Depends(database.get_db),
):
    query = (
        db.query(database.CompanyCollectionAssociation, database.Company)
        .join(database.Company)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
    )

    # Text search
    if search:
        query = query.filter(database.Company.company_name.ilike(f"%{search}%"))

    # Industry filter
    if industries:
        query = query.filter(database.Company.industry.in_(industries))

    # Funding filter
    if funding:
        query = query.filter(database.Company.funding_round.in_(funding))

    # Team size ranges
    if sizeRanges:
        range_clauses = []
        for r in sizeRanges:
            r = r.strip()
            if r == "0-10":
                range_clauses.append((database.Company.team_size >= 0) & (database.Company.team_size <= 10))
            elif r == "11-50":
                range_clauses.append((database.Company.team_size >= 11) & (database.Company.team_size <= 50))
            elif r == "51-200":
                range_clauses.append((database.Company.team_size >= 51) & (database.Company.team_size <= 200))
            elif r == "201-500":
                range_clauses.append((database.Company.team_size >= 201) & (database.Company.team_size <= 500))
            elif r == "500+":
                range_clauses.append((database.Company.team_size >= 501))
        if range_clauses:
            query = query.filter(or_(*range_clauses))

    # Liked only
    if liked_only:
        liked_list = (
            db.query(database.CompanyCollection)
            .filter(database.CompanyCollection.collection_name == "Liked Companies List")
            .first()
        )
        if liked_list is not None:
            liked_subq = (
                db.query(database.CompanyCollectionAssociation.company_id)
                .filter(database.CompanyCollectionAssociation.collection_id == liked_list.id)
                .subquery()
            )
            query = query.filter(database.Company.id.in_(liked_subq))

    total_count = query.with_entities(func.count()).scalar()

    results = query.offset(offset).limit(limit).all()
    companies = fetch_companies_with_liked(db, [company.id for _, company in results])

    return CompanyCollectionOutput(
        id=collection_id,
        collection_name=db.query(database.CompanyCollection).get(collection_id).collection_name,
        companies=companies,
        total=total_count,
        count=total_count,
    )


class DeleteCompaniesRequest(BaseModel):
    # Use Optional[...] for Python 3.9 compatibility (no PEP 604 `|`)
    mode: Optional[str] = "selected"
    companyIds: Optional[List[int]] = None
    excludeIds: Optional[List[int]] = None

# Remove companies from a collection (selected or all minus exclusions).
@router.post("/{collection_id}/companies/delete")
def delete_companies_from_collection(
    collection_id: uuid.UUID,
    payload: DeleteCompaniesRequest,
    db: Session = Depends(database.get_db),
):
    mode = (payload.mode or "selected").lower()
    q = db.query(database.CompanyCollectionAssociation).filter(
        database.CompanyCollectionAssociation.collection_id == collection_id
    )

    if mode == "all":
        if payload.excludeIds:
            q = q.filter(~database.CompanyCollectionAssociation.company_id.in_(payload.excludeIds))
        deleted = q.delete(synchronize_session=False)
        db.commit()
        return {"deleted": int(deleted)}

    # default: selected
    company_ids = payload.companyIds or []
    if not company_ids:
        return {"deleted": 0}
    deleted = (
        q.filter(database.CompanyCollectionAssociation.company_id.in_(company_ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": int(deleted)}

# Delete a collection and all its company associations.
@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(collection_id: uuid.UUID, db: Session = Depends(database.get_db)):
    # Prevent deletion while a bulk operation is writing to this collection
    r = redis.Redis.from_url(os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"), decode_responses=True)
    lock_owner = r.get(f"collection:{collection_id}:lock")
    if lock_owner:
        raise HTTPException(status_code=409, detail="Collection is busy due to an ongoing operation. Please cancel it first and try again.")

    collection = db.query(database.CompanyCollection).get(collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Delete associations first, then the collection
    (
        db.query(database.CompanyCollectionAssociation)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
        .delete(synchronize_session=False)
    )
    db.delete(collection)
    db.commit()
    return None
