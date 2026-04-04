from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.core.database import SessionLocal
from app.core.config import settings

router = APIRouter(tags=["health"])


def _ping_db(url: str | None = None) -> bool:
    try:
        if url:
            from sqlalchemy import create_engine
            engine = create_engine(url)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        else:
            db = SessionLocal()
            try:
                db.execute(text("SELECT 1"))
            finally:
                db.close()
        return True
    except Exception:
        return False


def _ping_valkey() -> bool:
    try:
        import redis
        r = redis.from_url(settings.VALKEY_URL)
        return r.ping()
    except Exception:
        return False


def _ping_minio() -> bool:
    try:
        from minio import Minio
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        client.list_buckets()
        return True
    except Exception:
        return False


@router.get("/health/live")
def liveness(request: Request):
    """
    K8s liveness — is the process alive and internally healthy?
    Reads from self-test cache (updated every 30s by background task).
    Returns 503 if: not yet run, stale (>60s), or any HARD check failed.
    """
    from app.core.self_test import get_liveness
    healthy, detail = get_liveness(request.app)
    if not healthy:
        return JSONResponse(status_code=503, content=detail)
    return detail


@router.get("/health/start")
def startup():
    """K8s startup — slow startup check (Alembic migrations etc.)"""
    db_ok = _ping_db()
    if not db_ok:
        from fastapi import Response
        return Response(status_code=503, content='{"status": "unavailable", "database": false}',
                        media_type="application/json")
    return {"status": "ok", "database": True}


@router.get("/health/ready")
def readiness():
    """
    K8s readiness — is the pod ready to serve traffic?
    HARD: database, valkey — False = pod removed from LB
    SOFT: database_reporting, minio — degraded but not removed
    """
    db_ok = _ping_db()
    valkey_ok = _ping_valkey()

    reporting_url = settings.DATABASE_REPORTING_URL or None
    db_reporting_ok = _ping_db(reporting_url) if reporting_url else None
    minio_ok = _ping_minio()

    hard_ok = db_ok and valkey_ok

    result = {
        "status": "ok" if hard_ok else "unavailable",
        "database": db_ok,
        "valkey": valkey_ok,
        "database_reporting": db_reporting_ok,
        "minio": minio_ok,
    }

    if not hard_ok:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=result)

    return result
