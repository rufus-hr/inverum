from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User, UserIdentity
from app.models.tenant import Tenant
from app.models.auth_audit_log import AuthAuditLog
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.core.security import create_access_token, create_refresh_token, ALGORITHM
from app.core.config import settings
from app.core.valkey import client
import bcrypt
import jwt

 
router = APIRouter(prefix="/auth", tags=["auth"])                                                                                                         
                
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent")

    tenant = db.query(Tenant).filter(
        Tenant.slug == data.tenant_slug,
        Tenant.deleted_at == None,
        Tenant.is_active == True
    ).first()
    if not tenant:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    identity = db.query(UserIdentity).filter(
        UserIdentity.provider == data.provider,
        UserIdentity.provider_id == data.provider_id,
        UserIdentity.tenant_id == tenant.id,
        UserIdentity.deleted_at == None
    ).first()

    if not identity:
        db.add(AuthAuditLog(
            tenant_id=tenant.id,
            user_id=None,
            action="login_fail",
            ip_address=ip,
            user_agent=user_agent,
            login_method="password",
            success=False,
            failure_reason="unknown_identity",
        ))
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_hash = identity.metadata_.get("password_hash")
    if not password_hash or not data.password:
        raise HTTPException(status_code=400, detail="Password required for this provider")

    if not bcrypt.checkpw(data.password.encode("utf-8"), password_hash.encode("utf-8")):
        db.add(AuthAuditLog(
            tenant_id=tenant.id,
            user_id=identity.user_id,
            action="login_fail",
            ip_address=ip,
            user_agent=user_agent,
            login_method="password",
            success=False,
            failure_reason="wrong_password",
        ))
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    identity.user.last_login_at = datetime.now(timezone.utc)
    db.add(AuthAuditLog(
        tenant_id=tenant.id,
        user_id=identity.user_id,
        action="login_success",
        ip_address=ip,
        user_agent=user_agent,
        login_method="password",
        success=True,
    ))
    db.commit()

    access_token = create_access_token(identity.user_id, identity.tenant_id)
    refresh_token = create_refresh_token(identity.user_id, identity.tenant_id)

    if client is None:
        raise HTTPException(status_code=503, detail="Session service unavailable")
    client.setex(f"refresh:{identity.user_id}", 60 * 60 * 24 * 7, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )

@router.post("/logout", status_code=204)
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if client is None:
        raise HTTPException(status_code=503, detail="Session service unavailable")
    client.delete(f"refresh:{user.id}")
    db.add(AuthAuditLog(
        tenant_id=user.tenant_id,
        user_id=user.id,
        action="logout",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent"),
        login_method=None,
        success=True,
    ))
    db.commit()
    return Response(status_code=204)

@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest):
    try:
        payload = jwt.decode(data.refresh_token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")

    stored_token = client.get(f"refresh:{user_id}")
    if not stored_token or stored_token != data.refresh_token:
        raise HTTPException(status_code=401, detail="Session expired")

    access_token = create_access_token(user_id, tenant_id)
    new_refresh_token = create_refresh_token(user_id, tenant_id)
    
    if client is None:
        raise HTTPException(status_code=503, detail="Session service unavailable")
    client.setex(f"refresh:{user_id}", 60 * 60 * 24 * 7, new_refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )
