#!/usr/bin/env python3
"""
Schema Apply — apply a diff SQL file to the database and bump schema version.

Usage:
    python scripts/db_apply.py diff.sql                    # apply diff, bump version
    python scripts/db_apply.py diff.sql --version 0.2.0    # apply diff, set specific version
    python scripts/db_apply.py --version 0.1.0             # just set version, no SQL
    python scripts/db_apply.py --show-version               # show current schema version
    python scripts/db_apply.py --reset                      # drop all, create_all, seed

Requires: psycopg2
"""
import argparse
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

APP_VERSION = os.environ.get("APP_VERSION", "0.1.0")


def get_db_url():
    host = os.environ["DATABASE_HOST"]
    port = os.environ.get("DATABASE_PORT", "5432")
    name = os.environ["DATABASE_NAME"]
    user = os.environ["DATABASE_USER"]
    pw = os.environ["DATABASE_PASSWORD"]
    return f"postgresql://{user}:{pw}@{host}:{port}/{name}"


def get_schema_version(conn) -> str | None:
    """Read current schema version from system_config."""
    cur = conn.cursor()
    cur.execute("SELECT value FROM system_config WHERE key = 'schema_version'")
    row = cur.fetchone()
    cur.close()
    return row[0] if row else None


def set_schema_version(conn, version: str):
    """Set schema version in system_config."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO system_config (key, value, created_at)
        VALUES ('schema_version', %s, %s)
        ON CONFLICT (key) DO UPDATE SET value = %s
    """, (version, datetime.now(timezone.utc), version))
    cur.close()


def apply_sql(conn, sql: str):
    """Apply SQL statements within a transaction."""
    cur = conn.cursor()
    cur.execute(sql)
    cur.close()


SHARED_DESK_VIEW_SQL = """
CREATE OR REPLACE VIEW shared_desk_availability AS
SELECT
    sdp.id AS profile_id,
    sdp.name,
    sdp.capacity,
    COUNT(w.id) FILTER (WHERE w.assigned_to_user_id IS NOT NULL) AS occupied,
    sdp.capacity - COUNT(w.id) FILTER (WHERE w.assigned_to_user_id IS NOT NULL) AS available
FROM shared_desk_profiles sdp
LEFT JOIN workspaces w
    ON w.shared_desk_profile_id = sdp.id
    AND w.deleted_at IS NULL
WHERE sdp.deleted_at IS NULL
GROUP BY sdp.id, sdp.name, sdp.capacity;
"""

LOCATION_TRIGGERS_SQL = """
-- 1. Resolve effective (location_id, storage_unit_id) for any box_id
CREATE OR REPLACE FUNCTION fn_resolve_box_container(p_box_id UUID)
RETURNS TABLE(eff_location_id UUID, eff_storage_unit_id UUID) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE box_ancestors AS (
        SELECT id, location_id, storage_unit_id, parent_box_id, status, 1 AS depth
        FROM boxes
        WHERE id = p_box_id AND deleted_at IS NULL
        UNION ALL
        SELECT b.id, b.location_id, b.storage_unit_id, b.parent_box_id, b.status, ba.depth + 1
        FROM boxes b
        JOIN box_ancestors ba ON b.id = ba.parent_box_id
        WHERE ba.location_id IS NULL
          AND ba.storage_unit_id IS NULL
          AND ba.status != 'in_transit'
          AND b.deleted_at IS NULL
          AND ba.depth < 20
    )
    SELECT
        CASE
            WHEN EXISTS (SELECT 1 FROM box_ancestors WHERE status = 'in_transit') THEN NULL::UUID
            ELSE COALESCE(root.location_id, su.location_id)
        END AS eff_location_id,
        CASE
            WHEN EXISTS (SELECT 1 FROM box_ancestors WHERE status = 'in_transit') THEN NULL::UUID
            ELSE root.storage_unit_id
        END AS eff_storage_unit_id
    FROM (
        SELECT location_id, storage_unit_id
        FROM box_ancestors
        ORDER BY depth DESC
        LIMIT 1
    ) root
    LEFT JOIN storage_units su ON su.id = root.storage_unit_id;
END;
$$ LANGUAGE plpgsql;

-- 2. BEFORE INSERT OR UPDATE on leaf tables (assets, stock_items, consumables, accessories)
CREATE OR REPLACE FUNCTION fn_resolve_leaf_location()
RETURNS TRIGGER AS $$
DECLARE
    v_loc_id UUID;
    v_su_id UUID;
BEGIN
    IF NEW.box_id IS NOT NULL THEN
        SELECT eff_location_id, eff_storage_unit_id
        INTO v_loc_id, v_su_id
        FROM fn_resolve_box_container(NEW.box_id);
        NEW.location_id := v_loc_id;
        NEW.storage_unit_id := v_su_id;
    ELSIF NEW.storage_unit_id IS NOT NULL THEN
        SELECT location_id INTO v_loc_id
        FROM storage_units
        WHERE id = NEW.storage_unit_id;
        NEW.location_id := v_loc_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resolve_leaf_location_assets ON assets;
CREATE TRIGGER trg_resolve_leaf_location_assets
BEFORE INSERT OR UPDATE OF box_id, storage_unit_id ON assets
FOR EACH ROW EXECUTE FUNCTION fn_resolve_leaf_location();

DROP TRIGGER IF EXISTS trg_resolve_leaf_location_stock_items ON stock_items;
CREATE TRIGGER trg_resolve_leaf_location_stock_items
BEFORE INSERT OR UPDATE OF box_id, storage_unit_id ON stock_items
FOR EACH ROW EXECUTE FUNCTION fn_resolve_leaf_location();

DROP TRIGGER IF EXISTS trg_resolve_leaf_location_consumables ON consumables;
CREATE TRIGGER trg_resolve_leaf_location_consumables
BEFORE INSERT OR UPDATE OF box_id, storage_unit_id ON consumables
FOR EACH ROW EXECUTE FUNCTION fn_resolve_leaf_location();

DROP TRIGGER IF EXISTS trg_resolve_leaf_location_accessories ON accessories;
CREATE TRIGGER trg_resolve_leaf_location_accessories
BEFORE INSERT OR UPDATE OF box_id, storage_unit_id ON accessories
FOR EACH ROW EXECUTE FUNCTION fn_resolve_leaf_location();

-- 3. AFTER UPDATE on boxes -> cascade to all descendant boxes' leaf items
CREATE OR REPLACE FUNCTION fn_cascade_box_location()
RETURNS TRIGGER AS $$
DECLARE
    v_loc_id UUID;
    v_su_id UUID;
BEGIN
    SELECT eff_location_id, eff_storage_unit_id
    INTO v_loc_id, v_su_id
    FROM fn_resolve_box_container(NEW.id);

    WITH RECURSIVE desc_boxes AS (
        SELECT id, status FROM boxes WHERE id = NEW.id AND deleted_at IS NULL
        UNION ALL
        SELECT b.id, b.status
        FROM boxes b
        JOIN desc_boxes db ON b.parent_box_id = db.id
        WHERE b.deleted_at IS NULL AND b.status != 'in_transit'
    )
    UPDATE assets SET location_id = v_loc_id, storage_unit_id = v_su_id
    WHERE box_id IN (SELECT id FROM desc_boxes) AND deleted_at IS NULL;

    WITH RECURSIVE desc_boxes AS (
        SELECT id, status FROM boxes WHERE id = NEW.id AND deleted_at IS NULL
        UNION ALL
        SELECT b.id, b.status
        FROM boxes b
        JOIN desc_boxes db ON b.parent_box_id = db.id
        WHERE b.deleted_at IS NULL AND b.status != 'in_transit'
    )
    UPDATE stock_items SET location_id = v_loc_id, storage_unit_id = v_su_id
    WHERE box_id IN (SELECT id FROM desc_boxes) AND deleted_at IS NULL;

    WITH RECURSIVE desc_boxes AS (
        SELECT id, status FROM boxes WHERE id = NEW.id AND deleted_at IS NULL
        UNION ALL
        SELECT b.id, b.status
        FROM boxes b
        JOIN desc_boxes db ON b.parent_box_id = db.id
        WHERE b.deleted_at IS NULL AND b.status != 'in_transit'
    )
    UPDATE consumables SET location_id = v_loc_id, storage_unit_id = v_su_id
    WHERE box_id IN (SELECT id FROM desc_boxes) AND deleted_at IS NULL;

    WITH RECURSIVE desc_boxes AS (
        SELECT id, status FROM boxes WHERE id = NEW.id AND deleted_at IS NULL
        UNION ALL
        SELECT b.id, b.status
        FROM boxes b
        JOIN desc_boxes db ON b.parent_box_id = db.id
        WHERE b.deleted_at IS NULL AND b.status != 'in_transit'
    )
    UPDATE accessories SET location_id = v_loc_id, storage_unit_id = v_su_id
    WHERE box_id IN (SELECT id FROM desc_boxes) AND deleted_at IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_box_location ON boxes;
CREATE TRIGGER trg_cascade_box_location
AFTER UPDATE OF location_id, storage_unit_id, parent_box_id, status ON boxes
FOR EACH ROW
WHEN (
    OLD.location_id IS DISTINCT FROM NEW.location_id OR
    OLD.storage_unit_id IS DISTINCT FROM NEW.storage_unit_id OR
    OLD.parent_box_id IS DISTINCT FROM NEW.parent_box_id OR
    OLD.status IS DISTINCT FROM NEW.status
)
EXECUTE FUNCTION fn_cascade_box_location();

-- 4. AFTER UPDATE on storage_units -> cascade location_id to child units, boxes, and leaf items
CREATE OR REPLACE FUNCTION fn_cascade_storage_unit_location()
RETURNS TRIGGER AS $$
BEGIN
    -- Cascade to direct child storage units (which will recursively fire if needed)
    UPDATE storage_units
    SET location_id = NEW.location_id
    WHERE parent_storage_unit_id = NEW.id
      AND location_id IS DISTINCT FROM NEW.location_id
      AND deleted_at IS NULL;

    -- Update leaf items directly in this storage unit (not in a box)
    UPDATE assets SET location_id = NEW.location_id
    WHERE storage_unit_id = NEW.id AND box_id IS NULL AND deleted_at IS NULL;

    UPDATE stock_items SET location_id = NEW.location_id
    WHERE storage_unit_id = NEW.id AND box_id IS NULL AND deleted_at IS NULL;

    UPDATE consumables SET location_id = NEW.location_id
    WHERE storage_unit_id = NEW.id AND box_id IS NULL AND deleted_at IS NULL;

    UPDATE accessories SET location_id = NEW.location_id
    WHERE storage_unit_id = NEW.id AND box_id IS NULL AND deleted_at IS NULL;

    -- Update leaf items in boxes (and descendant boxes) stored in this storage unit
    WITH RECURSIVE su_boxes AS (
        SELECT id FROM boxes
        WHERE storage_unit_id = NEW.id AND deleted_at IS NULL AND status != 'in_transit'
        UNION ALL
        SELECT b.id FROM boxes b
        JOIN su_boxes sb ON b.parent_box_id = sb.id
        WHERE b.deleted_at IS NULL AND b.status != 'in_transit'
    )
    UPDATE assets SET location_id = NEW.location_id
    WHERE box_id IN (SELECT id FROM su_boxes) AND deleted_at IS NULL;

    WITH RECURSIVE su_boxes AS (
        SELECT id FROM boxes
        WHERE storage_unit_id = NEW.id AND deleted_at IS NULL AND status != 'in_transit'
        UNION ALL
        SELECT b.id FROM boxes b
        JOIN su_boxes sb ON b.parent_box_id = sb.id
        WHERE b.deleted_at IS NULL AND b.status != 'in_transit'
    )
    UPDATE stock_items SET location_id = NEW.location_id
    WHERE box_id IN (SELECT id FROM su_boxes) AND deleted_at IS NULL;

    WITH RECURSIVE su_boxes AS (
        SELECT id FROM boxes
        WHERE storage_unit_id = NEW.id AND deleted_at IS NULL AND status != 'in_transit'
        UNION ALL
        SELECT b.id FROM boxes b
        JOIN su_boxes sb ON b.parent_box_id = sb.id
        WHERE b.deleted_at IS NULL AND b.status != 'in_transit'
    )
    UPDATE consumables SET location_id = NEW.location_id
    WHERE box_id IN (SELECT id FROM su_boxes) AND deleted_at IS NULL;

    WITH RECURSIVE su_boxes AS (
        SELECT id FROM boxes
        WHERE storage_unit_id = NEW.id AND deleted_at IS NULL AND status != 'in_transit'
        UNION ALL
        SELECT b.id FROM boxes b
        JOIN su_boxes sb ON b.parent_box_id = sb.id
        WHERE b.deleted_at IS NULL AND b.status != 'in_transit'
    )
    UPDATE accessories SET location_id = NEW.location_id
    WHERE box_id IN (SELECT id FROM su_boxes) AND deleted_at IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_storage_unit_location ON storage_units;
CREATE TRIGGER trg_cascade_storage_unit_location
AFTER UPDATE OF location_id ON storage_units
FOR EACH ROW
WHEN (OLD.location_id IS DISTINCT FROM NEW.location_id)
EXECUTE FUNCTION fn_cascade_storage_unit_location();
"""


def ensure_schema():
    """Ensure extensions, missing tables, views, and location triggers exist without dropping data."""
    import psycopg2
    from sqlalchemy import create_engine
    import app.models
    from app.core.database import Base

    url = get_db_url()
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    cur.close()
    conn.close()

    engine = create_engine(url)
    Base.metadata.create_all(bind=engine)
    engine.dispose()

    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(SHARED_DESK_VIEW_SQL)
    cur.execute(LOCATION_TRIGGERS_SQL)
    cur.close()
    if not get_schema_version(conn):
        set_schema_version(conn, APP_VERSION)
    conn.close()
    print(f"✓ Schema ensured ({len(Base.metadata.tables)} tables + views + triggers).", file=sys.stderr)


def reset_db():
    """Drop all tables, recreate from models, seed."""
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

    url = get_db_url()
    host = os.environ["DATABASE_HOST"]
    user = os.environ["DATABASE_USER"]
    pw = os.environ["DATABASE_PASSWORD"]
    name = os.environ["DATABASE_NAME"]

    # Drop and recreate schema via SSH or direct connection
    conn = psycopg2.connect(url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Drop all tables by dropping and recreating public schema
    cur.execute("DROP SCHEMA public CASCADE")
    cur.execute("CREATE SCHEMA public")
    cur.execute(f"GRANT ALL ON SCHEMA public TO {user}")
    cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    cur.close()
    conn.close()

    print("Schema dropped and recreated.", file=sys.stderr)

    # Create all tables from models
    from sqlalchemy import create_engine
    import app.models
    from app.core.database import Base

    engine = create_engine(url)
    Base.metadata.create_all(bind=engine)
    engine.dispose()

    table_count = len(Base.metadata.tables)
    print(f"Created {table_count} tables from models.", file=sys.stderr)

    # Create views and triggers
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(SHARED_DESK_VIEW_SQL)
    cur.execute(LOCATION_TRIGGERS_SQL)
    cur.close()
    conn.close()

    # Run seeds
    from app.core.database import SessionLocal
    from app.seeds.run import run_seeds

    db = SessionLocal()
    try:
        run_seeds(db)
        print("Seeds applied.", file=sys.stderr)
    except Exception as e:
        print(f"Seed failed: {e}", file=sys.stderr)
        db.rollback()
    finally:
        db.close()

    # Set schema version
    conn = psycopg2.connect(url)
    conn.autocommit = True
    set_schema_version(conn, APP_VERSION)
    conn.close()

    print(f"Schema version set to {APP_VERSION}.", file=sys.stderr)
    print(f"✓ Reset complete. {table_count} tables, version {APP_VERSION}.", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Apply schema diff + version tracking")
    parser.add_argument("sql_file", nargs="?", help="SQL diff file to apply")
    parser.add_argument("--version", type=str, help=f"Schema version to set (default: APP_VERSION={APP_VERSION})")
    parser.add_argument("--show-version", action="store_true", help="Show current schema version")
    parser.add_argument("--ensure-schema", action="store_true", help="Create missing tables/views idempotently")
    parser.add_argument("--reset", action="store_true", help="Drop all, create_all from models, seed, set version")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompt when applying SQL")
    args = parser.parse_args()

    if args.ensure_schema:
        ensure_schema()
        return

    if args.reset:
        confirm = input("This will DROP ALL TABLES and recreate. Type 'yes' to confirm: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.", file=sys.stderr)
            return
        reset_db()
        return

    import psycopg2

    conn = psycopg2.connect(get_db_url())

    if args.show_version:
        v = get_schema_version(conn)
        print(f"Schema version: {v or '(not set)'}")
        conn.close()
        return

    # Just set version, no SQL
    if not args.sql_file and args.version:
        conn.autocommit = True
        set_schema_version(conn, args.version)
        print(f"Schema version set to {args.version}.", file=sys.stderr)
        conn.close()
        return

    if not args.sql_file:
        parser.print_help()
        return

    # Read SQL
    with open(args.sql_file) as f:
        sql = f.read().strip()

    if not sql:
        print("SQL file is empty. Nothing to apply.", file=sys.stderr)
        conn.close()
        return

    version = args.version or APP_VERSION
    current = get_schema_version(conn)

    print(f"Current schema version: {current or '(not set)'}", file=sys.stderr)
    print(f"Applying {len(sql.splitlines())} lines of SQL...", file=sys.stderr)
    print(f"New version will be: {version}", file=sys.stderr)
    print(file=sys.stderr)

    # Show preview
    lines = sql.splitlines()
    for line in lines[:20]:
        print(f"  {line}", file=sys.stderr)
    if len(lines) > 20:
        print(f"  ... ({len(lines) - 20} more lines)", file=sys.stderr)

    print(file=sys.stderr)
    if not args.yes:
        confirm = input("Apply? [y/N]: ")
        if confirm.strip().lower() not in ("y", "yes"):
            print("Aborted.", file=sys.stderr)
            conn.close()
            return

    try:
        apply_sql(conn, sql)
        set_schema_version(conn, version)
        conn.commit()
        print(f"✓ Applied. Schema version: {version}", file=sys.stderr)
    except Exception as e:
        conn.rollback()
        print(f"✗ Failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
