import uuid

from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
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


class CompanyCollectionOutput(CompanyBatchOutput, CompanyCollectionMetadata):
    pass


@router.get("", response_model=list[CompanyCollectionMetadata])
def get_all_collection_metadata(
    db: Session = Depends(database.get_db),
):
    collections = db.query(database.CompanyCollection).all()

    return [
        CompanyCollectionMetadata(
            id=collection.id,
            collection_name=collection.collection_name,
        )
        for collection in collections
    ]


class CreateCollectionRequest(BaseModel):
    collection_name: str


@router.post("", response_model=CompanyCollectionMetadata)
def create_collection(payload: CreateCollectionRequest, db: Session = Depends(database.get_db)):
    new_collection = database.CompanyCollection(collection_name=payload.collection_name)
    db.add(new_collection)
    db.commit()
    db.refresh(new_collection)
    return CompanyCollectionMetadata(id=new_collection.id, collection_name=new_collection.collection_name)


@router.get("/{collection_id}", response_model=CompanyCollectionOutput)
def get_company_collection_by_id(
    collection_id: uuid.UUID,
    offset: int = Query(
        0, description="The number of items to skip from the beginning"
    ),
    limit: int = Query(10, description="The number of items to fetch"),
    db: Session = Depends(database.get_db),
):
    query = (
        db.query(database.CompanyCollectionAssociation, database.Company)
        .join(database.Company)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
    )

    total_count = query.with_entities(func.count()).scalar()

    results = query.offset(offset).limit(limit).all()
    companies = fetch_companies_with_liked(db, [company.id for _, company in results])

    return CompanyCollectionOutput(
        id=collection_id,
        collection_name=db.query(database.CompanyCollection)
        .get(collection_id)
        .collection_name,
        companies=companies,
        total=total_count,
    )


class DeleteCompaniesRequest(BaseModel):
    companyIds: list[int]


@router.post("/{collection_id}/companies/delete")
def delete_companies_from_collection(
    collection_id: uuid.UUID,
    payload: DeleteCompaniesRequest,
    db: Session = Depends(database.get_db),
):
    if not payload.companyIds:
        return {"deleted": 0}

    deleted = (
        db.query(database.CompanyCollectionAssociation)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
        .filter(database.CompanyCollectionAssociation.company_id.in_(payload.companyIds))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": int(deleted)}


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(collection_id: uuid.UUID, db: Session = Depends(database.get_db)):
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
