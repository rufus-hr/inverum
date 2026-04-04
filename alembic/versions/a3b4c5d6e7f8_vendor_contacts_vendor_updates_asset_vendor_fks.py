"""vendor_contacts_vendor_updates_asset_vendor_fks

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-04-04

- vendors: add oib, vat_id, vendor_types JSONB, manufacturer_id, email, phone, address
- vendors: add indexes (tenant+name, GIN on vendor_types)
- vendor_contacts: new table
- vendor_contracts: add name, document_id
- assets: add purchased_from_vendor_id, purchase_invoice_ref, vendor_contract_id
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # vendors — new columns
    op.add_column("vendors", sa.Column("oib", sa.String(20), nullable=True))
    op.add_column("vendors", sa.Column("vat_id", sa.String(30), nullable=True))
    op.add_column("vendors", sa.Column("vendor_types", JSONB, nullable=True))
    op.add_column("vendors", sa.Column("manufacturer_id", sa.UUID(),
                  sa.ForeignKey("manufacturers.id"), nullable=True))
    op.add_column("vendors", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("vendors", sa.Column("phone", sa.String(50), nullable=True))
    op.add_column("vendors", sa.Column("address", sa.Text(), nullable=True))

    op.create_index("idx_vendors_tenant", "vendors", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_vendors_tenant_name", "vendors", ["tenant_id", "name"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_vendors_types_gin", "vendors", ["vendor_types"],
                    postgresql_using="gin",
                    postgresql_ops={"vendor_types": "jsonb_path_ops"})

    # vendor_contacts — new table
    op.create_table(
        "vendor_contacts",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("vendor_id", sa.UUID(), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(100), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_vendor_contacts_vendor", "vendor_contacts", ["vendor_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))

    # vendor_contracts — add name and document_id
    op.add_column("vendor_contracts", sa.Column("name", sa.String(255), nullable=True))
    op.add_column("vendor_contracts", sa.Column("document_id", sa.UUID(), nullable=True))
    op.create_index("idx_vendor_contracts_active", "vendor_contracts",
                    ["tenant_id", "end_date"],
                    postgresql_where=sa.text("deleted_at IS NULL"))

    # assets — vendor FK columns
    op.add_column("assets", sa.Column("purchased_from_vendor_id", sa.UUID(),
                  sa.ForeignKey("vendors.id"), nullable=True))
    op.add_column("assets", sa.Column("purchase_invoice_ref", sa.String(255), nullable=True))
    op.add_column("assets", sa.Column("vendor_contract_id", sa.UUID(),
                  sa.ForeignKey("vendor_contracts.id"), nullable=True))
    op.create_index("idx_assets_vendor", "assets", ["purchased_from_vendor_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))


def downgrade() -> None:
    op.drop_index("idx_assets_vendor", table_name="assets")
    op.drop_column("assets", "vendor_contract_id")
    op.drop_column("assets", "purchase_invoice_ref")
    op.drop_column("assets", "purchased_from_vendor_id")

    op.drop_index("idx_vendor_contracts_active", table_name="vendor_contracts")
    op.drop_column("vendor_contracts", "document_id")
    op.drop_column("vendor_contracts", "name")

    op.drop_index("idx_vendor_contacts_vendor", table_name="vendor_contacts")
    op.drop_table("vendor_contacts")

    op.drop_index("idx_vendors_types_gin", table_name="vendors")
    op.drop_index("idx_vendors_tenant_name", table_name="vendors")
    op.drop_index("idx_vendors_tenant", table_name="vendors")
    op.drop_column("vendors", "address")
    op.drop_column("vendors", "phone")
    op.drop_column("vendors", "email")
    op.drop_column("vendors", "manufacturer_id")
    op.drop_column("vendors", "vendor_types")
    op.drop_column("vendors", "vat_id")
    op.drop_column("vendors", "oib")
