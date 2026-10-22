#!/usr/bin/env python3
"""
Schema Diff — compare current DB schema against SQLAlchemy models.
Uses SQLAlchemy's built-in schema comparison (no external tools).

Usage:
    python scripts/db_diff.py              # show diff SQL
    python scripts/db_diff.py --safe       # skip DROP statements
    python scripts/db_diff.py --out diff.sql  # save to file
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


def get_db_url():
    host = os.environ["DATABASE_HOST"]
    port = os.environ.get("DATABASE_PORT", "5432")
    name = os.environ["DATABASE_NAME"]
    user = os.environ["DATABASE_USER"]
    pw = os.environ["DATABASE_PASSWORD"]
    return f"postgresql://{user}:{pw}@{host}:{port}/{name}"


def diff_schema(safe: bool = False) -> list[str]:
    """Compare DB schema against SQLAlchemy models. Return list of SQL statements."""
    from sqlalchemy import create_engine, inspect, text, MetaData
    import app.models  # register all models
    from app.core.database import Base

    url = get_db_url()
    engine = create_engine(url)
    inspector = inspect(engine)

    desired = Base.metadata
    existing_tables = set(inspector.get_table_names())
    desired_tables = set(desired.tables.keys())

    statements = []

    # Tables to create (in desired but not in DB)
    new_tables = desired_tables - existing_tables
    for tname in sorted(new_tables):
        table = desired.tables[tname]
        statements.append(f"-- NEW TABLE: {tname}")
        create_sql = str(table.compile(engine).string) if hasattr(table, 'compile') else None
        # Use CreateTable DDL
        from sqlalchemy.schema import CreateTable
        ddl = str(CreateTable(table).compile(engine))
        statements.append(ddl.strip() + ";")
        statements.append("")

    # Tables to drop (in DB but not in desired)
    if not safe:
        drop_tables = existing_tables - desired_tables - {"alembic_version"}
        for tname in sorted(drop_tables):
            statements.append(f"DROP TABLE IF EXISTS {tname} CASCADE;")

    # Column diffs for existing tables
    for tname in sorted(desired_tables & existing_tables):
        desired_table = desired.tables[tname]

        # Get existing columns
        existing_cols = {c["name"]: c for c in inspector.get_columns(tname)}
        desired_cols = {c.name: c for c in desired_table.columns}

        # New columns
        for cname in sorted(set(desired_cols) - set(existing_cols)):
            col = desired_cols[cname]
            col_type = col.type.compile(engine.dialect)
            nullable = "NULL" if col.nullable else "NOT NULL"
            default = ""
            if col.server_default:
                default = f" DEFAULT {col.server_default.arg}"
            statements.append(f"ALTER TABLE {tname} ADD COLUMN {cname} {col_type} {nullable}{default};")

        # Dropped columns
        if not safe:
            for cname in sorted(set(existing_cols) - set(desired_cols)):
                statements.append(f"ALTER TABLE {tname} DROP COLUMN {cname};")

        # Type changes (basic comparison)
        for cname in sorted(set(desired_cols) & set(existing_cols)):
            desired_col = desired_cols[cname]
            existing_col = existing_cols[cname]

            desired_type = str(desired_col.type.compile(engine.dialect)).upper()
            existing_type = str(existing_col["type"]).upper()

            # Normalize common type aliases
            type_map = {"BIGINT": "BIGINT", "INTEGER": "INTEGER", "BOOLEAN": "BOOLEAN",
                        "VARCHAR": "VARCHAR", "TEXT": "TEXT", "TIMESTAMP WITH TIME ZONE": "TIMESTAMP WITH TIME ZONE"}

            if desired_type != existing_type:
                # Skip false positives (UUID comparisons etc)
                if "UUID" in desired_type and "UUID" in existing_type:
                    continue
                if desired_type.startswith("VARCHAR") and existing_type.startswith("VARCHAR"):
                    # Compare lengths
                    if desired_type == existing_type:
                        continue
                statements.append(f"-- TYPE CHANGE: {tname}.{cname}: {existing_type} -> {desired_type}")
                statements.append(f"ALTER TABLE {tname} ALTER COLUMN {cname} TYPE {desired_type};")

            # Nullable changes
            if desired_col.nullable != existing_col.get("nullable", True):
                if desired_col.nullable:
                    statements.append(f"ALTER TABLE {tname} ALTER COLUMN {cname} DROP NOT NULL;")
                else:
                    statements.append(f"ALTER TABLE {tname} ALTER COLUMN {cname} SET NOT NULL;")

    # Index diffs
    for tname in sorted(desired_tables & existing_tables):
        desired_table = desired.tables[tname]
        existing_indexes = {idx["name"]: idx for idx in inspector.get_indexes(tname)}
        desired_indexes = {idx.name: idx for idx in desired_table.indexes if idx.name}

        for iname in sorted(set(desired_indexes) - set(existing_indexes)):
            idx = desired_indexes[iname]
            cols = ", ".join(c.name for c in idx.columns)
            unique = "UNIQUE " if idx.unique else ""
            statements.append(f"CREATE {unique}INDEX {iname} ON {tname} ({cols});")

        if not safe:
            for iname in sorted(set(existing_indexes) - set(desired_indexes)):
                statements.append(f"DROP INDEX IF EXISTS {iname};")

    engine.dispose()
    return statements


def main():
    parser = argparse.ArgumentParser(description="Schema diff: DB vs SQLAlchemy models")
    parser.add_argument("--safe", action="store_true", help="Skip destructive (DROP) statements")
    parser.add_argument("--out", type=str, help="Save SQL to file")
    args = parser.parse_args()

    print("Comparing database schema against models...", file=sys.stderr)
    statements = diff_schema(safe=args.safe)

    if not statements:
        print("✓ Schema is up to date. No changes needed.", file=sys.stderr)
        return

    sql = "\n".join(statements)
    print(f"--- Schema diff ({len(statements)} statements) ---", file=sys.stderr)
    print()
    print(sql)

    if args.out:
        with open(args.out, "w") as f:
            f.write(sql + "\n")
        print(f"\nSaved to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
