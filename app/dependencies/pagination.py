from fastapi import HTTPException


class PaginationParams:
    def __init__(self, page: int = 1, limit: int = 30):
        if page < 1:
            raise HTTPException(status_code=400, detail="Invalid page number, must be 1 or greater")
        if limit < 1:
            raise HTTPException(status_code=400, detail="Invalid limit, must be 1 or greater")
        if limit > 500:
            raise HTTPException(status_code=400, detail="Invalid limit, must be 500 or less")
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit


class CursorPaginationParams:
    """
    Keyset/cursor-based pagination for large tables (assets, audit logs, events).
    Cursor is an opaque string encoding (created_at, id) — both DESC.
    Use instead of LIMIT/OFFSET when table can exceed 10k rows.
    """
    def __init__(self, cursor: str | None = None, limit: int = 50):
        if limit < 1:
            raise HTTPException(status_code=400, detail="Invalid limit, must be 1 or greater")
        if limit > 200:
            raise HTTPException(status_code=400, detail="Invalid limit, must be 200 or less")
        self.limit = limit
        self.cursor = _decode_cursor(cursor) if cursor else None

    @staticmethod
    def encode(created_at, id) -> str:
        import base64
        raw = f"{created_at.isoformat()}|{id}"
        return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple:
    import base64
    from datetime import datetime, timezone
    import uuid
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_str, id_str = raw.split("|", 1)
        ts = datetime.fromisoformat(ts_str)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return (ts, uuid.UUID(id_str))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cursor")
