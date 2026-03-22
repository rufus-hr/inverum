import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.vendor_contract import VendorContract
from app.schemas.vendor_contract import VendorContractCreate, VendorContractModify, VendorContractResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/vendor-contracts", tags=["vendor-contracts"])


@router.get("/", response_model=PagedResponse[VendorContractResponse])
def list_vendor_contracts(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("vendor_contract:read")),
    db: Session = Depends(get_db),
):
    query = db.query(VendorContract).filter(
        VendorContract.tenant_id == user.tenant_id,
        VendorContract.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{contract_id}", response_model=VendorContractResponse)
def get_vendor_contract(
    contract_id: uuid.UUID,
    user: User = Depends(require_permission("vendor_contract:read")),
    db: Session = Depends(get_db),
):
    c = db.query(VendorContract).filter(
        VendorContract.id == contract_id,
        VendorContract.tenant_id == user.tenant_id,
        VendorContract.deleted_at == None,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Vendor contract not found")
    return c


@router.post("/", response_model=VendorContractResponse, status_code=201)
def create_vendor_contract(
    data: VendorContractCreate,
    user: User = Depends(require_permission("vendor_contract:create")),
    db: Session = Depends(get_db),
):
    c = VendorContract(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/{contract_id}", response_model=VendorContractResponse)
def update_vendor_contract(
    contract_id: uuid.UUID,
    data: VendorContractModify,
    user: User = Depends(require_permission("vendor_contract:modify")),
    db: Session = Depends(get_db),
):
    c = db.query(VendorContract).filter(
        VendorContract.id == contract_id,
        VendorContract.tenant_id == user.tenant_id,
        VendorContract.deleted_at == None,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Vendor contract not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{contract_id}", status_code=204)
def delete_vendor_contract(
    contract_id: uuid.UUID,
    user: User = Depends(require_permission("vendor_contract:delete")),
    db: Session = Depends(get_db),
):
    c = db.query(VendorContract).filter(
        VendorContract.id == contract_id,
        VendorContract.tenant_id == user.tenant_id,
        VendorContract.deleted_at == None,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Vendor contract not found")
    c.deleted_at = datetime.now(timezone.utc)
    db.commit()
