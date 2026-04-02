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

class TemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    trigger_event: str
    asset_category: str | None
    frequency: str
    is_required: bool
    requires_confirmation: bool
    is_active: bool

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

class ReorderRequest(BaseModel):
    item_ids: list[uuid.UUID]  # ordered list

class CompletionResponse(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    asset_id: uuid.UUID
    status: str
    triggered_by: str
    all_checked: bool
    submitted_at: datetime | None
    confirmed_at: datetime | None

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
        ChecklistTemplate.deleted_at == None,
    )
    if trigger_event:
        q = q.filter(ChecklistTemplate.trigger_event == trigger_event)
    if asset_category:
        q = q.filter(ChecklistTemplate.asset_category == asset_category)
    return q.order_by(ChecklistTemplate.name).all()


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
        ChecklistCompletion.deleted_at == None,
    )
    if asset_id:
        q = q.filter(ChecklistCompletion.asset_id == asset_id)
    if status:
        q = q.filter(ChecklistCompletion.status == status)
    return q.order_by(ChecklistCompletion.created_at.desc()).all()


@router.get("/completions/{completion_id}", response_model=CompletionResponse)
def get_completion(
    completion_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user_has_permission(user, "checklist:view", db):
        raise HTTPException(status_code=403)
    return _get_completion(db, completion_id, user.tenant_id)


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
    return completion


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
    return completion


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
        Asset.deleted_at == None,
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
        ChecklistTemplate.deleted_at == None,
    ).first()
    if not t:
        raise HTTPException(status_code=404)
    return t


def _get_item(db: Session, item_id: uuid.UUID, tenant_id: uuid.UUID) -> ChecklistItem:
    item = db.query(ChecklistItem).filter(
        ChecklistItem.id == item_id,
        ChecklistItem.tenant_id == tenant_id,
        ChecklistItem.deleted_at == None,
    ).first()
    if not item:
        raise HTTPException(status_code=404)
    return item


def _get_completion(db: Session, completion_id: uuid.UUID, tenant_id: uuid.UUID) -> ChecklistCompletion:
    c = db.query(ChecklistCompletion).filter(
        ChecklistCompletion.id == completion_id,
        ChecklistCompletion.tenant_id == tenant_id,
        ChecklistCompletion.deleted_at == None,
    ).first()
    if not c:
        raise HTTPException(status_code=404)
    return c


def _execute_pending_transition(db: Session, completion: ChecklistCompletion) -> None:
    """
    Execute the pending asset transition after all completions are closed.
    Updates asset state and clears is_checklist_pending.
    """
    transition = completion.pending_transition
    if not transition:
        return

    asset = db.get(Asset, completion.asset_id)
    if not asset:
        return

    t_type = transition.get("type")

    if t_type == "status_change":
        new_status_id = transition.get("new_status_id")
        if new_status_id:
            asset.status_id = uuid.UUID(new_status_id)

    elif t_type == "assignment_change":
        from app.models.asset_assignment import AssetAssignment
        now = datetime.now(timezone.utc)
        close_id = transition.get("close_assignment_id")
        if close_id:
            existing = db.get(AssetAssignment, uuid.UUID(close_id))
            if existing and existing.returned_at is None:
                existing.returned_at = now
                existing.is_active = False

        assigned_to_type = transition.get("assigned_to_type")
        assigned_to_id = transition.get("assigned_to_id")
        assigned_by_id = transition.get("assigned_by_id")
        if assigned_to_type and assigned_to_id:
            db.add(AssetAssignment(
                tenant_id=asset.tenant_id,
                asset_id=asset.id,
                assigned_to_type=assigned_to_type,
                assigned_to_id=uuid.UUID(assigned_to_id),
                assigned_by=uuid.UUID(assigned_by_id) if assigned_by_id else completion.triggered_by_user_id,
                notes=transition.get("notes"),
            ))

    elif t_type == "return_to_stock":
        from app.models.asset_assignment import AssetAssignment
        now = datetime.now(timezone.utc)
        assignment_id = transition.get("assignment_id")
        returned_by_id = transition.get("returned_by_id")
        if assignment_id:
            a = db.get(AssetAssignment, uuid.UUID(assignment_id))
            if a and a.returned_at is None:
                a.returned_at = now
                a.is_active = False
                if returned_by_id:
                    a.returned_by = uuid.UUID(returned_by_id)
                if transition.get("notes"):
                    a.notes = transition["notes"]

    asset.is_checklist_pending = False
