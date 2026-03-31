import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies.auth import require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams
from app.models.user import User
from app.models.workspace import Workspace
from app.models.shared_desk_profile import SharedDeskProfile
from app.schemas.pagination import PagedResponse
from app.schemas.workspace import (
    SharedDeskProfileCreate,
    SharedDeskProfileUpdate,
    SharedDeskProfileResponse,
    SharedDeskAvailabilityResponse,
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceAssignRequest,
    WorkspaceResponse,
)

router = APIRouter(tags=["workspaces"])


# ---------------------------------------------------------------------------
# SharedDeskProfile CRUD
# ---------------------------------------------------------------------------

@router.post("/shared-desk-profiles", response_model=SharedDeskProfileResponse, status_code=201)
def create_shared_desk_profile(
    data: SharedDeskProfileCreate,
    user: User = Depends(require_permission("workspace:manage")),
    db: Session = Depends(get_db),
):
    profile = SharedDeskProfile(tenant_id=user.tenant_id, **data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/shared-desk-profiles", response_model=PagedResponse[SharedDeskProfileResponse])
def list_shared_desk_profiles(
    location_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("workspace:read")),
    db: Session = Depends(get_db),
):
    q = db.query(SharedDeskProfile).filter(
        SharedDeskProfile.tenant_id == user.tenant_id,
        SharedDeskProfile.deleted_at.is_(None),
    )
    if location_id:
        q = q.filter(SharedDeskProfile.location_id == location_id)
    if organization_id:
        q = q.filter(SharedDeskProfile.organization_id == organization_id)
    total = q.count()
    items = q.order_by(SharedDeskProfile.name).offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/shared-desk-profiles/{profile_id}", response_model=SharedDeskProfileResponse)
def get_shared_desk_profile(
    profile_id: uuid.UUID,
    user: User = Depends(require_permission("workspace:read")),
    db: Session = Depends(get_db),
):
    return _get_profile(db, profile_id, user.tenant_id)


@router.put("/shared-desk-profiles/{profile_id}", response_model=SharedDeskProfileResponse)
def update_shared_desk_profile(
    profile_id: uuid.UUID,
    data: SharedDeskProfileUpdate,
    user: User = Depends(require_permission("workspace:manage")),
    db: Session = Depends(get_db),
):
    profile = _get_profile(db, profile_id, user.tenant_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/shared-desk-profiles/{profile_id}", status_code=204)
def delete_shared_desk_profile(
    profile_id: uuid.UUID,
    user: User = Depends(require_permission("workspace:manage")),
    db: Session = Depends(get_db),
):
    profile = _get_profile(db, profile_id, user.tenant_id)
    profile.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.get("/shared-desk-profiles/{profile_id}/availability", response_model=SharedDeskAvailabilityResponse)
def get_shared_desk_availability(
    profile_id: uuid.UUID,
    user: User = Depends(require_permission("workspace:read")),
    db: Session = Depends(get_db),
):
    _get_profile(db, profile_id, user.tenant_id)
    row = db.execute(
        text("SELECT profile_id, name, capacity, occupied, available FROM shared_desk_availability WHERE profile_id = :pid"),
        {"pid": profile_id},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found in availability view")
    return SharedDeskAvailabilityResponse(
        profile_id=row.profile_id,
        name=row.name,
        capacity=row.capacity,
        occupied=row.occupied,
        available=row.available,
    )


# ---------------------------------------------------------------------------
# Workspace CRUD
# ---------------------------------------------------------------------------

@router.post("/workspaces", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    data: WorkspaceCreate,
    user: User = Depends(require_permission("workspace:manage")),
    db: Session = Depends(get_db),
):
    if data.type not in ("personal", "shared"):
        raise HTTPException(status_code=422, detail="type must be 'personal' or 'shared'")

    if data.type == "shared" and data.shared_desk_profile_id:
        _get_profile(db, data.shared_desk_profile_id, user.tenant_id)

    workspace = Workspace(tenant_id=user.tenant_id, **data.model_dump())
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace


@router.get("/workspaces", response_model=PagedResponse[WorkspaceResponse])
def list_workspaces(
    location_id: uuid.UUID | None = None,
    type: str | None = None,
    assigned_to_user_id: uuid.UUID | None = None,
    free_only: bool = False,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("workspace:read")),
    db: Session = Depends(get_db),
):
    q = db.query(Workspace).filter(
        Workspace.tenant_id == user.tenant_id,
        Workspace.deleted_at.is_(None),
    )
    if location_id:
        q = q.filter(Workspace.location_id == location_id)
    if type:
        q = q.filter(Workspace.type == type)
    if assigned_to_user_id:
        q = q.filter(Workspace.assigned_to_user_id == assigned_to_user_id)
    if free_only:
        q = q.filter(Workspace.assigned_to_user_id.is_(None))
    total = q.count()
    items = q.order_by(Workspace.name).offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: uuid.UUID,
    user: User = Depends(require_permission("workspace:read")),
    db: Session = Depends(get_db),
):
    return _get_workspace(db, workspace_id, user.tenant_id)


@router.put("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    user: User = Depends(require_permission("workspace:manage")),
    db: Session = Depends(get_db),
):
    workspace = _get_workspace(db, workspace_id, user.tenant_id)
    updates = data.model_dump(exclude_none=True)

    if "type" in updates and updates["type"] not in ("personal", "shared"):
        raise HTTPException(status_code=422, detail="type must be 'personal' or 'shared'")

    for field, value in updates.items():
        setattr(workspace, field, value)
    db.commit()
    db.refresh(workspace)
    return workspace


@router.delete("/workspaces/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: uuid.UUID,
    user: User = Depends(require_permission("workspace:manage")),
    db: Session = Depends(get_db),
):
    workspace = _get_workspace(db, workspace_id, user.tenant_id)
    workspace.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/workspaces/{workspace_id}/assign", response_model=WorkspaceResponse)
def assign_workspace(
    workspace_id: uuid.UUID,
    body: WorkspaceAssignRequest,
    user: User = Depends(require_permission("workspace:manage")),
    db: Session = Depends(get_db),
):
    """
    Assign or unassign a user to/from a workspace.
    For shared workspaces: validates org/dept match and desk availability.
    """
    workspace = _get_workspace(db, workspace_id, user.tenant_id)

    if body.user_id is None:
        # Unassign
        workspace.assigned_to_user_id = None
        db.commit()
        db.refresh(workspace)
        return workspace

    # Validate shared desk profile constraints
    if workspace.type == "shared" and workspace.shared_desk_profile_id:
        profile = _get_profile(db, workspace.shared_desk_profile_id, user.tenant_id)

        # Check org/dept access on the profile
        from app.models.user import User as UserModel
        target_user = db.get(UserModel, body.user_id)
        if not target_user or target_user.tenant_id != user.tenant_id:
            raise HTTPException(status_code=404, detail="User not found")

        if profile.organization_id and target_user.organization_id != profile.organization_id:
            raise HTTPException(
                status_code=422,
                detail="User's organization does not match the shared desk profile",
            )

        # Check department via employee record if profile has department_id
        if profile.department_id:
            from app.models.employee import Employee
            emp = (
                db.get(Employee, target_user.employee_id)
                if target_user.employee_id
                else None
            )
            if not emp or emp.department_id != profile.department_id:
                raise HTTPException(
                    status_code=422,
                    detail="User's department does not match the shared desk profile",
                )

        # Check availability — another free desk must exist in this profile
        # (current workspace may already be free, so we check profile-level availability)
        row = db.execute(
            text("SELECT available FROM shared_desk_availability WHERE profile_id = :pid"),
            {"pid": workspace.shared_desk_profile_id},
        ).first()
        currently_assigned = workspace.assigned_to_user_id is not None
        available = row.available if row else 0
        # If the workspace is already free, it counts as one available slot — no net change
        if not currently_assigned and available == 0:
            raise HTTPException(status_code=422, detail="No available desks in this profile")

    workspace.assigned_to_user_id = body.user_id
    db.commit()
    db.refresh(workspace)
    return workspace


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_profile(db: Session, profile_id: uuid.UUID, tenant_id: uuid.UUID) -> SharedDeskProfile:
    p = db.query(SharedDeskProfile).filter(
        SharedDeskProfile.id == profile_id,
        SharedDeskProfile.tenant_id == tenant_id,
        SharedDeskProfile.deleted_at.is_(None),
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Shared desk profile not found")
    return p


def _get_workspace(db: Session, workspace_id: uuid.UUID, tenant_id: uuid.UUID) -> Workspace:
    w = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.tenant_id == tenant_id,
        Workspace.deleted_at.is_(None),
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return w
