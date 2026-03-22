from sqlalchemy.orm import Session
from fastapi import Depends
from app.core.database import SessionLocal
from app.models.tenant import Tenant


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_tenant_db(tenant_id: str, db: Session = Depends(get_db)):
    """
    For now returns the default session.
    In server-mode isolation this will return a session
    connected to the tenant's own DB server.
    """
    return db
