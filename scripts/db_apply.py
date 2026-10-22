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


def ensure_schema():
    """Ensure extensions, missing tables, and views exist without dropping data."""
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
    cur.close()
    if not get_schema_version(conn):
        set_schema_version(conn, APP_VERSION)
    conn.close()
    print(f"✓ Schema ensured ({len(Base.metadata.tables)} tables + views).", file=sys.stderr)


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

    # Create views
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(SHARED_DESK_VIEW_SQL)
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
