from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PagedResponse(BaseModel, Generic[T]):
    """Offset-based pagination — use for small/medium tables (<10k rows)."""
    items: list[T]
    total: int
    page: int
    limit: int
    pages: int


class CursorPagedResponse(BaseModel, Generic[T]):
    """Cursor-based pagination — use for large tables (assets, audit logs, events)."""
    items: list[T]
    next_cursor: str | None  # None = last page
    limit: int
