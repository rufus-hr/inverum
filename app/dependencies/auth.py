import jwt
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.config import settings
from app.dependencies.db import get_db                                                                                                                    
from app.models.user import User
from app.models.group import Group, UserGroup
from app.models.role_permission import RolePermission
from app.models.permission import Permission

                                                                                                                                                          
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
                                                                                                                                                          
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])                                                                            
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")                                                                                      
                
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    if not user_id or not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == tenant_id,
        User.deleted_at == None
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user

def require_permission(permission_code: str):
    def check(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        perm = (
            db.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Group, Group.role_id == RolePermission.role_id)
            .join(UserGroup, UserGroup.group_id == Group.id)
            .filter(
                UserGroup.user_id == user.id,
                Permission.code == permission_code,
                Permission.is_active == True,
                or_(                                                                                                                                                  
                    UserGroup.expires_at.is_(None),
                    UserGroup.expires_at > datetime.now(timezone.utc)
                )                                                                                                                                                     
            )
            .first()
        )
        if not perm:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return check

