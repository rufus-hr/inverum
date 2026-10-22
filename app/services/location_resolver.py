"""
resolve_effective_location
--------------------------
Resolves the "real" location of any entity that participates in the
container hierarchy (Asset, StockItem, Consumable, Accessory, Box).

Container chain:
    entity → box → box → ... → storage_unit → location
                            └─────────────────→ location

Rules:
  1. If entity has location_id directly → that IS the effective location.
  2. If entity has storage_unit_id → effective location = storage_unit.location_id.
  3. If entity has box_id → walk up the box tree until we find a node with
     location_id or storage_unit_id, then apply rules 1/2.
  4. in_transit boxes have no resolvable location (returns None).

Usage:
    from app.services.location_resolver import resolve_effective_location

    loc_id = await resolve_effective_location(session, entity)
    # or bulk:
    mapping = await bulk_resolve_effective_location(session, entity_ids, "box")
"""
from __future__ import annotations

import uuid
from typing import Any, Protocol

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class _HasContainerFields(Protocol):
    """Minimal duck-type for any model that has the three container FKs."""
    location_id: uuid.UUID | None
    storage_unit_id: uuid.UUID | None
    box_id: uuid.UUID | None


async def resolve_effective_location(
    session: AsyncSession,
    entity: _HasContainerFields,
) -> uuid.UUID | None:
    """
    Resolves effective location_id for a single entity.
    Returns None if entity is in_transit (unreachable location).
    """
    if entity.location_id is not None:
        return entity.location_id

    if entity.storage_unit_id is not None:
        row = await session.execute(
            text("SELECT location_id FROM storage_units WHERE id = :id"),
            {"id": entity.storage_unit_id},
        )
        return row.scalar_one_or_none()

    if entity.box_id is not None:
        return await _resolve_via_box(session, entity.box_id)

    return None


async def _resolve_via_box(
    session: AsyncSession,
    box_id: uuid.UUID,
) -> uuid.UUID | None:
    """
    Walks up the box tree using a recursive CTE to find the root container's
    location_id or storage_unit_id.
    Returns None for in_transit chains.
    """
    result = await session.execute(
        text("""
            WITH RECURSIVE box_chain AS (
                SELECT
                    id,
                    location_id,
                    storage_unit_id,
                    parent_box_id,
                    status
                FROM boxes
                WHERE id = :box_id
                  AND deleted_at IS NULL

                UNION ALL

                SELECT
                    b.id,
                    b.location_id,
                    b.storage_unit_id,
                    b.parent_box_id,
                    b.status
                FROM boxes b
                JOIN box_chain bc ON b.id = bc.parent_box_id
                WHERE bc.location_id IS NULL
                  AND bc.storage_unit_id IS NULL
                  AND bc.status != 'in_transit'
                  AND b.deleted_at IS NULL
            )
            SELECT
                bc.location_id,
                bc.storage_unit_id,
                su.location_id AS su_location_id
            FROM box_chain bc
            LEFT JOIN storage_units su ON su.id = bc.storage_unit_id
            WHERE bc.location_id IS NOT NULL
               OR bc.storage_unit_id IS NOT NULL
            LIMIT 1
        """),
        {"box_id": box_id},
    )
    row = result.mappings().first()
    if row is None:
        return None  # in_transit or orphaned chain
    return row["location_id"] or row["su_location_id"]


async def bulk_resolve_effective_location(
    session: AsyncSession,
    entity_ids: list[uuid.UUID],
    entity_table: str,
) -> dict[uuid.UUID, uuid.UUID | None]:
    """
    Bulk resolves effective location for a list of entity IDs.
    entity_table: "assets" | "stock_items" | "consumables" | "accessories" | "boxes"

    Returns: {entity_id: effective_location_id | None}
    """
    if not entity_ids:
        return {}

    # Validate table name to prevent SQL injection
    allowed_tables = {"assets", "stock_items", "consumables", "accessories", "boxes"}
    if entity_table not in allowed_tables:
        raise ValueError(f"entity_table must be one of {allowed_tables}")

    result = await session.execute(
        text(f"""
            WITH RECURSIVE box_chain AS (
                -- Seed: entities that are directly in a box
                SELECT
                    e.id       AS entity_id,
                    b.id       AS box_id,
                    b.location_id,
                    b.storage_unit_id,
                    b.parent_box_id,
                    b.status
                FROM {entity_table} e
                JOIN boxes b ON b.id = e.box_id
                WHERE e.id = ANY(:ids)
                  AND e.box_id IS NOT NULL
                  AND b.deleted_at IS NULL

                UNION ALL

                SELECT
                    bc.entity_id,
                    b.id,
                    b.location_id,
                    b.storage_unit_id,
                    b.parent_box_id,
                    b.status
                FROM boxes b
                JOIN box_chain bc ON b.id = bc.parent_box_id
                WHERE bc.location_id IS NULL
                  AND bc.storage_unit_id IS NULL
                  AND bc.status != 'in_transit'
                  AND b.deleted_at IS NULL
            ),
            resolved_via_box AS (
                SELECT DISTINCT ON (entity_id)
                    entity_id,
                    COALESCE(location_id, su.location_id) AS effective_location_id
                FROM box_chain bc
                LEFT JOIN storage_units su ON su.id = bc.storage_unit_id
                WHERE bc.location_id IS NOT NULL OR bc.storage_unit_id IS NOT NULL
                ORDER BY entity_id
            ),
            direct AS (
                SELECT
                    e.id AS entity_id,
                    COALESCE(
                        e.location_id,
                        su.location_id
                    ) AS effective_location_id
                FROM {entity_table} e
                LEFT JOIN storage_units su ON su.id = e.storage_unit_id
                WHERE e.id = ANY(:ids)
                  AND e.box_id IS NULL
            )
            SELECT entity_id, effective_location_id FROM direct
            UNION ALL
            SELECT entity_id, effective_location_id FROM resolved_via_box
        """),
        {"ids": entity_ids},
    )

    return {row.entity_id: row.effective_location_id for row in result}
