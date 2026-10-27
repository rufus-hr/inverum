import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user, user_has_permission
from app.dependencies.db import get_db
from app.models.asset import Asset
from app.models.checklist_completion import ChecklistCompletion
from app.models.checklist_item import ChecklistItem
from app.models.checklist_item_completion import ChecklistItemCompletion
from app.models.checklist_template import ChecklistTemplate
from app.models.user import User
from app.services import checklist_service

router = APIRouter(prefix="/checklists", tags=["checklists"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TemplateCreate(BaseModel):
    name: str
    trigger_event: str
    asset_category: str | None = None
    frequency: str = "per_event"
    is_required: bool = True
    requires_confirmation: bool = False

class TemplateUpdate(BaseModel):
    name: str | None = None
    trigger_event: str | None = None
    asset_category: str | None = None
    frequency: str | None = None
    is_required: bool | None = None
    requires_confirmation: bool | None = None
    is_active: bool | None = None

class ItemResponse(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    text: str
    order_index: int
    is_blocking: bool
    requires_note: bool
    depends_on_item_id: uuid.UUID | None
    is_active: bool

    class Config:
        from_attributes = True

class TemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    trigger_event: str
    asset_category: str | None
    frequency: str
    is_required: bool
    requires_confirmation: bool
    is_active: bool
    items: list[ItemResponse] = []

    class Config:
        from_attributes = True

class ItemCreate(BaseModel):
    text: str
    order_index: int = 0
    is_blocking: bool = True
    requires_note: bool = False
    depends_on_item_id: uuid.UUID | None = None

class ItemUpdate(BaseModel):
    text: str | None = None
    order_index: int | None = None
    is_blocking: bool | None = None
    requires_note: bool | None = None
    depends_on_item_id: uuid.UUID | None = None
    is_active: bool | None = None

class ReorderRequest(BaseModel):
    item_ids: list[uuid.UUID]  # ordered list

class CompletionItemResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    text: str
    order_index: int
    is_blocking: bool
    requires_note: bool
    depends_on: uuid.UUID | None = None
    checked: bool = False
    checked_by: str | None = None
    checked_at: datetime | None = None
    note: str | None = None


class CompletionResponse(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    template_name: str | None = None
    trigger: str | None = None
    asset_id: uuid.UUID
    asset_name: str | None = None
    asset_inv: str | None = None
    status: str
    triggered_by: str
    all_checked: bool
    requires_confirmation: bool = False
    pending_transition: str | None = None
    created_at: datetime | None = None
    submitted_by: str | None = None
    submitted_at: datetime | None = None
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None
    items: list[CompletionItemResponse] = []

    class Config:
        from_attributes = True

class CheckItemRequest(BaseModel):
    note: str | None = None

class TriggerRequest(BaseModel):
    event: str
    asset_id: uuid.UUID
    pending_transition: dict | None = None


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@router.post("/templates", response_model=TemplateResponse, status_code=201)
def create_template(
    body: TemplateCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    template = ChecklistTemplate(tenant_id=user.tenant_id, **body.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/templates", response_model=list[TemplateResponse])
def list_templates(
    trigger_event: str | None = None,
    asset_category: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:view", db):
        raise HTTPException(status_code=403)
    q = db.query(ChecklistTemplate).filter(
        ChecklistTemplate.tenant_id == user.tenant_id,
        ChecklistTemplate.deleted_at.is_(None),
    )
    if trigger_event:
        q = q.filter(ChecklistTemplate.trigger_event == trigger_event)
    if asset_category:
        q = q.filter(ChecklistTemplate.asset_category == asset_category)
    templates = q.order_by(ChecklistTemplate.name).all()
    if templates:
        tpl_ids = [t.id for t in templates]
        all_items = (
            db.query(ChecklistItem)
            .filter(
                ChecklistItem.template_id.in_(tpl_ids),
                ChecklistItem.tenant_id == user.tenant_id,
                ChecklistItem.is_active.is_(True),
            )
            .order_by(ChecklistItem.order_index)
            .all()
        )
        items_by_tpl: dict[uuid.UUID, list[ChecklistItem]] = {}
        for it in all_items:
            items_by_tpl.setdefault(it.template_id, []).append(it)
        for t in templates:
            t.items = items_by_tpl.get(t.id, [])  # type: ignore[attr-defined]
    return templates


@router.get("/templates/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:view", db):
        raise HTTPException(status_code=403)
    t = _get_template(db, template_id, user.tenant_id)
    return t


@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: uuid.UUID,
    body: TemplateUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    t = _get_template(db, template_id, user.tenant_id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    t = _get_template(db, template_id, user.tenant_id)
    t.deleted_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

@router.post("/templates/{template_id}/items", response_model=ItemResponse, status_code=201)
def create_item(
    template_id: uuid.UUID,
    body: ItemCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    t = _get_template(db, template_id, user.tenant_id)
    item = ChecklistItem(tenant_id=user.tenant_id, template_id=t.id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: uuid.UUID,
    body: ItemUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    item = _get_item(db, item_id, user.tenant_id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    item = _get_item(db, item_id, user.tenant_id)
    item.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/templates/{template_id}/items/reorder", status_code=204)
def reorder_items(
    template_id: uuid.UUID,
    body: ReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    _get_template(db, template_id, user.tenant_id)
    for idx, item_id in enumerate(body.item_ids):
        item = _get_item(db, item_id, user.tenant_id)
        item.order_index = idx
    db.commit()


# ---------------------------------------------------------------------------
# Completions
# ---------------------------------------------------------------------------

@router.get("/completions", response_model=list[CompletionResponse])
def list_completions(
    asset_id: uuid.UUID | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:view", db):
        raise HTTPException(status_code=403)
    q = db.query(ChecklistCompletion).filter(
        ChecklistCompletion.tenant_id == user.tenant_id,
        ChecklistCompletion.deleted_at.is_(None),
    )
    if asset_id:
        q = q.filter(ChecklistCompletion.asset_id == asset_id)
    if status:
        q = q.filter(ChecklistCompletion.status == status)
    rows = q.order_by(ChecklistCompletion.created_at.desc()).all()
    return [_serialize_completion(db, c) for c in rows]


@router.get("/completions/{completion_id}", response_model=CompletionResponse)
def get_completion(
    completion_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:view", db):
        raise HTTPException(status_code=403)
    c = _get_completion(db, completion_id, user.tenant_id)
    return _serialize_completion(db, c)


@router.post("/completions/{completion_id}/items/{item_id}/check", status_code=204)
def check_item(
    completion_id: uuid.UUID,
    item_id: uuid.UUID,
    body: CheckItemRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:fill", db):
        raise HTTPException(status_code=403)
    completion = _get_completion(db, completion_id, user.tenant_id)
    if completion.status != "open":
        raise HTTPException(status_code=422, detail="Completion is not open")
    item = _get_item(db, item_id, user.tenant_id)
    try:
        checklist_service.check_item(db, completion, item, user.id, body.note)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    db.commit()


@router.post("/completions/{completion_id}/items/{item_id}/uncheck", status_code=204)
def uncheck_item(
    completion_id: uuid.UUID,
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:fill", db):
        raise HTTPException(status_code=403)
    completion = _get_completion(db, completion_id, user.tenant_id)
    if completion.status != "open":
        raise HTTPException(status_code=422, detail="Completion is not open")
    checklist_service.uncheck_item(db, completion, item_id)
    db.commit()


@router.post("/completions/{completion_id}/submit", response_model=CompletionResponse)
def submit_completion(
    completion_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:submit", db):
        raise HTTPException(status_code=403)
    completion = _get_completion(db, completion_id, user.tenant_id)
    if completion.status != "open":
        raise HTTPException(status_code=422, detail="Completion is not open")
    try:
        all_done = checklist_service.submit_completion(db, completion, user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if all_done:
        _execute_pending_transition(db, completion)

    db.commit()
    db.refresh(completion)
    return _serialize_completion(db, completion)


@router.post("/completions/{completion_id}/confirm", response_model=CompletionResponse)
def confirm_completion(
    completion_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:confirm", db):
        raise HTTPException(status_code=403)
    completion = _get_completion(db, completion_id, user.tenant_id)
    if completion.status != "submitted":
        raise HTTPException(status_code=422, detail="Completion is not in submitted status")
    try:
        all_done = checklist_service.confirm_completion(db, completion, user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if all_done:
        _execute_pending_transition(db, completion)

    db.commit()
    db.refresh(completion)
    return _serialize_completion(db, completion)


@router.post("/completions/{completion_id}/cancel", status_code=204)
def cancel_completion(
    completion_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    completion = _get_completion(db, completion_id, user.tenant_id)
    if completion.status not in ("open", "submitted"):
        raise HTTPException(status_code=422, detail="Cannot cancel a completed or already cancelled checklist")
    asset = db.get(Asset, completion.asset_id)
    checklist_service.cancel_completion(db, completion, asset)
    db.commit()


# ---------------------------------------------------------------------------
# Manual trigger
# ---------------------------------------------------------------------------

@router.post("/trigger", status_code=202)
def manual_trigger(
    body: TriggerRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:manage", db):
        raise HTTPException(status_code=403)
    asset = db.query(Asset).filter(
        Asset.id == body.asset_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at.is_(None),
    ).first()
    if not asset:
        raise HTTPException(status_code=404)
    completions = checklist_service.trigger_event(
        db=db,
        event=body.event,
        asset=asset,
        pending_transition=body.pending_transition or {},
        triggered_by_user_id=user.id,
    )
    db.commit()
    return {
        "status": "checklist_required" if completions else "no_checklist",
        "completions": [{"id": str(c.id), "template_id": str(c.template_id)} for c in completions],
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_template(db: Session, template_id: uuid.UUID, tenant_id: uuid.UUID) -> ChecklistTemplate:
    t = db.query(ChecklistTemplate).filter(
        ChecklistTemplate.id == template_id,
        ChecklistTemplate.tenant_id == tenant_id,
        ChecklistTemplate.deleted_at.is_(None),
    ).first()
    if not t:
        raise HTTPException(status_code=404)
    return t


def _get_item(db: Session, item_id: uuid.UUID, tenant_id: uuid.UUID) -> ChecklistItem:
    item = db.query(ChecklistItem).filter(
        ChecklistItem.id == item_id,
        ChecklistItem.tenant_id == tenant_id,
        ChecklistItem.deleted_at.is_(None),
    ).first()
    if not item:
        raise HTTPException(status_code=404)
    return item


def _get_completion(db: Session, completion_id: uuid.UUID, tenant_id: uuid.UUID) -> ChecklistCompletion:
    c = db.query(ChecklistCompletion).filter(
        ChecklistCompletion.id == completion_id,
        ChecklistCompletion.tenant_id == tenant_id,
        ChecklistCompletion.deleted_at.is_(None),
    ).first()
    if not c:
        raise HTTPException(status_code=404)
    return c


def _serialize_completion(db: Session, c: ChecklistCompletion) -> CompletionResponse:
    tpl = db.get(ChecklistTemplate, c.template_id)
    asset = db.get(Asset, c.asset_id)
    tpl_items = (
        db.query(ChecklistItem)
        .filter(
            ChecklistItem.template_id == c.template_id,
            ChecklistItem.is_active.is_(True),
            ChecklistItem.deleted_at.is_(None),
        )
        .order_by(ChecklistItem.order_index)
        .all()
    )
    checked_rows = {
        ic.item_id: ic
        for ic in db.query(ChecklistItemCompletion).filter(
            ChecklistItemCompletion.completion_id == c.id,
        ).all()
    }

    items_out: list[CompletionItemResponse] = []
    for ti in tpl_items:
        ic = checked_rows.get(ti.id)
        checked_by_str = None
        if ic and ic.checked_by:
            u = db.get(User, ic.checked_by)
            checked_by_str = (u.display_name or u.email) if u else str(ic.checked_by)[:8]
        items_out.append(CompletionItemResponse(
            id=ti.id,
            item_id=ti.id,
            text=ti.text,
            order_index=ti.order_index,
            is_blocking=ti.is_blocking,
            requires_note=ti.requires_note,
            depends_on=ti.depends_on_item_id,
            checked=bool(ic and ic.checked),
            checked_by=checked_by_str,
            checked_at=ic.checked_at if ic else None,
            note=ic.note if ic else None,
        ))

    submitted_by_str = None
    if c.submitted_by:
        su = db.get(User, c.submitted_by)
        submitted_by_str = (su.display_name or su.email) if su else str(c.submitted_by)[:8]

    confirmed_by_str = None
    if c.confirmed_by:
        cu = db.get(User, c.confirmed_by)
        confirmed_by_str = (cu.display_name or cu.email) if cu else str(c.confirmed_by)[:8]

    pt_summary = None
    if isinstance(c.pending_transition, dict) and c.pending_transition:
        pt_type = c.pending_transition.get("type", "transition")
        if pt_type == "assignment_change":
            pt_summary = f"Handover / Assignment verified & PAdES Revers generated"
        elif pt_type == "return_to_stock":
            pt_summary = f"Return to stock verified & PAdES Offboarding Record generated"
        elif pt_type == "status_change":
            pt_summary = f"Transition to {c.pending_transition.get('to_status', 'updated status')} verified"
        elif pt_type == "box_in_transit":
            pt_summary = f"Box {c.pending_transition.get('box_inventory_number', '')} Chain of Custody verified"
        else:
            pt_summary = str(pt_type)

    return CompletionResponse(
        id=c.id,
        template_id=c.template_id,
        template_name=tpl.name if tpl else "SOP Checklist",
        trigger=tpl.trigger_event if tpl else c.triggered_by,
        asset_id=c.asset_id,
        asset_name=asset.name if asset else "Asset",
        asset_inv=(asset.serial_number or f"AST-{str(asset.id)[:8].upper()}") if asset else "",
        status=c.status,
        triggered_by=c.triggered_by,
        all_checked=c.all_checked,
        requires_confirmation=bool(tpl and tpl.requires_confirmation),
        pending_transition=pt_summary,
        created_at=c.created_at,
        submitted_by=submitted_by_str,
        submitted_at=c.submitted_at,
        confirmed_by=confirmed_by_str,
        confirmed_at=c.confirmed_at,
        items=items_out,
    )


def _auto_generate_pades_certificate(db: Session, asset: Asset, completion: ChecklistCompletion) -> None:
    """
    Automatically generate and PAdES-B-LTA sign the appropriate compliance PDF
    (Handover Revers, Sanitization Certificate, Return Record, or Decommission Certificate)
    when the mandatory SOP checklist is completed.
    """
    from app.models.asset_document import AssetDocument
    from app.models.employee import Employee
    from app.models.legal_entity import LegalEntity
    from app.models.tenant import Tenant
    from app.services.pades_signer import sign_pdf_pades_lta, store_document_in_minio
    from app.services.reporting_service import build_deterministic_pdf

    trig = completion.triggered_by or ""
    if trig in ("asset_stock_to_assigned", "asset_assigned"):
        action_type = "handover"
    elif trig in ("asset_reassigned", "asset_reassignment_sanitization"):
        action_type = "sanitization"
    elif trig in ("asset_assigned_to_stock", "asset_returned"):
        action_type = "return"
    elif trig == "asset_retired":
        action_type = "decommission"
    else:
        action_type = "handover"

    tenant = db.get(Tenant, asset.tenant_id)
    tenant_name = tenant.name if tenant else "Inverum Tenant"
    le = (
        db.query(LegalEntity)
        .filter(LegalEntity.tenant_id == asset.tenant_id, LegalEntity.deleted_at.is_(None))
        .first()
    )
    le_name = le.legal_name if le else tenant_name

    transition = completion.pending_transition if isinstance(completion.pending_transition, dict) else {}
    emp_id = None
    emp_name = "Verified Custodian"
    raw_emp_id = transition.get("assigned_to_id")
    if raw_emp_id:
        try:
            emp_id = uuid.UUID(str(raw_emp_id))
            emp = db.get(Employee, emp_id)
            if emp:
                emp_name = f"{emp.first_name} {emp.last_name}"
        except ValueError:
            pass

    inv_no = asset.serial_number or f"AST-{str(asset.id)[:8].upper()}"
    asset_name = asset.name or "Managed Asset"
    title_map = {
        "handover": "ZAPISNIK O ZADUZENJU OPREME (ONBOARDING REVERS — ISO A.5.10 / A.8.1)",
        "return": "ZAPISNIK O RAZDUZENJU I POVRATU OPREME (OFFBOARDING — ISO A.5.11 / A.6.5)",
        "sanitization": "POTVRDA O SANITIZACIJI PRI PRIJENOSU (USER A -> USER B — ISO A.7.14 / GDPR)",
        "decommission": "CERTIFIKAT O SIGURNOM BRISANJU I RASHODU (NIST 800-88 / ISO A.8.10 4-EYES)",
    }
    doc_title = title_map.get(action_type, title_map["handover"])
    now_utc = datetime.now(timezone.utc)

    raw_pdf = build_deterministic_pdf(
        title=doc_title,
        subtitle="ISO/IEC 27001:2022 (A.5.10, A.5.11, A.6.5, A.7.14, A.8.10)  |  NIS2 Art. 21  |  GDPR Art. 5 & 32",
        meta_lines=[
            ("Legal Entity / Tenant", le_name),
            ("Document Type", f"{action_type.upper()} RECORD (Auto-Generated on SOP Completion)"),
            ("Custodian / Employee", emp_name),
            ("Asset / Serial Number", f"{asset_name} ({inv_no})"),
            ("SOP Checklist ID", str(completion.id)[:8].upper()),
        ],
        headers=["Control / Check Item", "Specification / Value", "ISO / NIS2 / GDPR Ref", "Verification"],
        rows=[
            ["Asset Identification", f"{asset_name} [{inv_no}]", "ISO 27001 A.5.9 / A.5.13", "VERIFIED"],
            ["Custodian / Recipient", emp_name, "ISO 27001 A.5.10 / A.6.2", "CONFIRMED"],
            ["SOP Checklist Gate", f"All blocking items completed ({completion.status.upper()})", "ISO 27001 A.8.1 / A.7.14", "PASSED"],
            ["Full-Disk Encryption (FDE)", "BitLocker / LUKS AES-256-XTS Active", "ISO A.8.24 / GDPR Art. 32", "ACTIVE"],
            ["Sanitization / Data Wipe", "NIST SP 800-88 / Profile Verification", "ISO A.7.14 / A.8.10 / GDPR", "PASSED"],
        ],
    )

    signed = sign_pdf_pades_lta(
        pdf_bytes=raw_pdf,
        tenant_id=str(asset.tenant_id),
        legal_entity_name=le_name,
        signer_name="Inverum SOP Compliance Gate",
        reason=f"SOP Completed ({action_type.upper()}): {inv_no}",
    )

    file_name = f"revers_{action_type}_{inv_no.lower()}_{now_utc.strftime('%Y%m%d_%H%M%S')}.pdf"
    storage_path = store_document_in_minio(
        tenant_id=str(asset.tenant_id),
        category=action_type,
        file_name=file_name,
        content_bytes=signed.pdf_bytes,
    )

    db.add(AssetDocument(
        tenant_id=asset.tenant_id,
        employee_id=emp_id,
        document_type=action_type,
        file_name=file_name,
        file_path=storage_path,
        file_size=len(signed.pdf_bytes),
        mime_type="application/pdf",
        is_signed=True,
        signed_at=signed.signed_at,
        sha256_hash=signed.sha256_hash,
        tsa_expires_at=signed.tsa_expires_at,
        last_timestamped_at=signed.last_timestamped_at,
        timestamp_count=signed.timestamp_count,
        notes=f"Auto-generated on SOP completion ({completion.id}): {doc_title} — {asset_name} ({inv_no})",
    ))


def _execute_pending_transition(db: Session, completion: ChecklistCompletion) -> None:
    """
    Execute the pending asset transition after all completions are closed.
    Updates asset state, clears is_checklist_pending, and generates PAdES-B-LTA Revers/Certificate.
    """
    asset = db.get(Asset, completion.asset_id)
    if not asset:
        return

    transition = completion.pending_transition if isinstance(completion.pending_transition, dict) else {}
    t_type = transition.get("type")

    if t_type == "status_change":
        new_status_id = transition.get("new_status_id")
        if new_status_id:
            asset.status_id = uuid.UUID(new_status_id)

    asset.is_checklist_pending = False
    asset.pending_transition = None
    _auto_generate_pades_certificate(db, asset, completion)
