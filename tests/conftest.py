"""
Shared test fixtures and utilities for Inverum backend tests.
Compatible with both `pytest` and standard library `unittest` (`venv/bin/python -m unittest`).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import bcrypt

import app.models  # noqa: F401
from app.models.asset import Asset
from app.models.box import Box
from app.models.employee import Employee
from app.models.location import Location
from app.models.storage_unit import StorageUnit
from app.models.supply import Supply
from app.models.stock_item import StockItem
from app.models.stock_movement import StockMovement
from app.models.system_config import SystemConfig
from app.models.tenant import Tenant
from app.models.user import User, UserIdentity


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _matches_expr(item: Any, expr: Any) -> bool:
    """Evaluate simple SQLAlchemy column comparison expressions against an in-memory model instance."""
    left = getattr(expr, "left", None)
    right = getattr(expr, "right", None)
    op = getattr(expr, "operator", None)
    if left is None or op is None:
        return True

    attr_name = getattr(left, "key", None) or getattr(left, "name", None)
    if not attr_name or not hasattr(item, attr_name):
        return True

    actual = getattr(item, attr_name)
    op_name = getattr(op, "__name__", str(op))

    # Handle IS NULL / IS NOT NULL
    if right is None or getattr(right, "__class__", None).__name__ == "Null":
        if "is_not" in op_name or "isnot" in op_name:
            return actual is not None
        if "is_" in op_name or op_name == "is":
            return actual is None
        return True

    expected = getattr(right, "value", right)
    if op_name in ("eq", "is_", "is"):
        return actual == expected
    if op_name in ("ne", "is_not", "isnot"):
        return actual != expected
    return True


@dataclass
class InMemoryQuery:
    items: list[Any]

    def filter(self, *args: Any, **kwargs: Any) -> "InMemoryQuery":
        filtered = list(self.items)
        for expr in args:
            filtered = [it for it in filtered if _matches_expr(it, expr)]
        if kwargs:
            filtered = [
                it
                for it in filtered
                if all(getattr(it, k, None) == v for k, v in kwargs.items())
            ]
        return InMemoryQuery(filtered)

    def filter_by(self, **kwargs: Any) -> "InMemoryQuery":
        filtered = [
            item
            for item in self.items
            if all(getattr(item, k, None) == v for k, v in kwargs.items())
        ]
        return InMemoryQuery(filtered)

    def order_by(self, *args: Any) -> "InMemoryQuery":
        return self

    def offset(self, n: int) -> "InMemoryQuery":
        return InMemoryQuery(self.items[n:])

    def limit(self, n: int) -> "InMemoryQuery":
        return InMemoryQuery(self.items[:n])

    def first(self) -> Any | None:
        return self.items[0] if self.items else None

    def all(self) -> list[Any]:
        return list(self.items)

    def count(self) -> int:
        return len(self.items)

    def scalar(self) -> Any:
        return len(self.items)


@dataclass
class FakeTestingSession:
    """
    Lightweight in-memory session for unit & router logic tests that run 100% offline
    without requiring a live PostgreSQL or Valkey instance in the sandbox.
    """
    store: dict[type, list[Any]] = field(default_factory=dict)
    committed: bool = False
    active_employee_count_override: int | None = None

    def add(self, obj: Any) -> None:
        cls = type(obj)
        self.store.setdefault(cls, [])
        if getattr(obj, "id", None) is None and hasattr(obj, "id"):
            obj.id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        if hasattr(obj, "created_at") and getattr(obj, "created_at", None) is None:
            obj.created_at = now
        if hasattr(obj, "updated_at") and getattr(obj, "updated_at", None) is None:
            obj.updated_at = now
        if hasattr(obj, "is_active") and getattr(obj, "is_active", None) is None:
            obj.is_active = True
        if obj not in self.store[cls]:
            self.store[cls].append(obj)

    def delete(self, obj: Any) -> None:
        cls = type(obj)
        if cls in self.store and obj in self.store[cls]:
            self.store[cls].remove(obj)

    def commit(self) -> None:
        self.committed = True

    def flush(self) -> None:
        pass

    def refresh(self, obj: Any) -> None:
        pass

    def query(self, model: Any) -> InMemoryQuery:
        if hasattr(model, "clauses") or str(model).startswith("count("):
            if self.active_employee_count_override is not None:
                return InMemoryQuery([None] * self.active_employee_count_override)
            emps = [
                e for e in self.store.get(Employee, [])
                if getattr(e, "deleted_at", None) is None and getattr(e, "is_active", True)
            ]
            return InMemoryQuery(emps)
        return InMemoryQuery(list(self.store.get(model, [])))


def create_test_tenant_and_admin(db: FakeTestingSession, password: str = "SecretPass123!") -> tuple[Tenant, User, UserIdentity]:
    tenant = Tenant(
        id=uuid.uuid4(),
        name="Hrvatska Pošta d.d.",
        slug="hp-test",
        is_active=True,
        deleted_at=None,
    )
    db.add(tenant)

    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        display_name="Test Admin",
        email="admin@posta.hr",
        is_active=True,
        deleted_at=None,
    )
    db.add(user)

    identity = UserIdentity(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=tenant.id,
        provider="local",
        provider_id="admin",
        metadata_={"password_hash": hash_password(password)},
        deleted_at=None,
    )
    identity.user = user
    db.add(identity)
    return tenant, user, identity
