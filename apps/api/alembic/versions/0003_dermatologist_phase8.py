"""Phase 8 — Dermatologist review enhancements.

Adds per-product derm action/override columns, encrypted patient note,
review timing, and product suggestion table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # recommendation_products — per-product dermatologist action
    # -----------------------------------------------------------------------
    op.add_column(
        "recommendation_products",
        sa.Column("derm_action", sa.String(20), nullable=True),
        # values: approve | modify | remove
    )
    op.add_column(
        "recommendation_products",
        sa.Column("derm_override_note", sa.Text, nullable=True),
    )

    # -----------------------------------------------------------------------
    # review_queue — encrypted patient note + review timing
    # -----------------------------------------------------------------------
    op.add_column(
        "review_queue",
        sa.Column("patient_encrypted_note", sa.Text, nullable=True),
    )
    op.add_column(
        "review_queue",
        sa.Column("review_started_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -----------------------------------------------------------------------
    # product_suggestions — dermatologist-submitted new product requests
    # -----------------------------------------------------------------------
    op.create_table(
        "product_suggestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("suggested_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("brand", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("price_inr", sa.Float, nullable=True),
        sa.Column("product_url", sa.String(1000), nullable=True),
        sa.Column("key_ingredients", postgresql.ARRAY(sa.TEXT), nullable=True),
        sa.Column("targets_conditions", postgresql.ARRAY(sa.TEXT), nullable=True),
        sa.Column("reason_for_suggestion", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        # pending | approved | rejected
        sa.Column("admin_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_product_suggestions_status",
        "product_suggestions",
        ["status"],
    )


def downgrade() -> None:
    op.drop_table("product_suggestions")
    op.drop_column("review_queue", "review_started_at")
    op.drop_column("review_queue", "patient_encrypted_note")
    op.drop_column("recommendation_products", "derm_override_note")
    op.drop_column("recommendation_products", "derm_action")
