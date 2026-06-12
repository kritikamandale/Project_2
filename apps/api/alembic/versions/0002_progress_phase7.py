"""Phase 7 — routine_checkins, product_feedback, in_app_notifications

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── New ENUM types ─────────────────────────────────────────────────────
    op.execute("CREATE TYPE adherence_level_enum AS ENUM ('yes', 'mostly', 'no')")
    op.execute("CREATE TYPE product_rating_enum AS ENUM ('working', 'unsure', 'not_working')")
    op.execute(
        "CREATE TYPE notification_type_enum AS ENUM "
        "('scan_reminder', 'derm_review_complete', 'new_product_suggestion', 'routine_tip')"
    )

    # ── routine_checkins ───────────────────────────────────────────────────
    op.create_table(
        "routine_checkins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("checkin_date", sa.Date, nullable=False),
        sa.Column(
            "adherence",
            sa.Enum("yes", "mostly", "no", name="adherence_level_enum", create_constraint=False),
            nullable=False,
        ),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
    )
    op.create_unique_constraint(
        "uq_routine_checkin_user_date", "routine_checkins", ["user_id", "checkin_date"]
    )
    op.create_index("ix_routine_checkins_user_id", "routine_checkins", ["user_id"])
    op.create_index("ix_routine_checkins_user_date", "routine_checkins", ["user_id", "checkin_date"])

    # ── product_feedback ───────────────────────────────────────────────────
    op.create_table(
        "product_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "product_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "recommendation_product_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recommendation_products.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column(
            "rating",
            sa.Enum("working", "unsure", "not_working", name="product_rating_enum", create_constraint=False),
            nullable=False,
        ),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False,
        ),
    )
    op.create_unique_constraint(
        "uq_product_feedback_user_product", "product_feedback", ["user_id", "product_id"]
    )
    op.create_index("ix_product_feedback_user_id", "product_feedback", ["user_id"])
    op.create_index("ix_product_feedback_product_id", "product_feedback", ["product_id"])
    op.create_index("ix_product_feedback_user_product", "product_feedback", ["user_id", "product_id"])

    # ── in_app_notifications ───────────────────────────────────────────────
    op.create_table(
        "in_app_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "type",
            sa.Enum(
                "scan_reminder", "derm_review_complete", "new_product_suggestion", "routine_tip",
                name="notification_type_enum", create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("action_url", sa.String(500)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False,
        ),
    )
    op.create_index("ix_in_app_notifications_user_id", "in_app_notifications", ["user_id"])
    op.create_index(
        "ix_in_app_notifications_user_read", "in_app_notifications", ["user_id", "is_read"]
    )


def downgrade() -> None:
    op.drop_table("in_app_notifications")
    op.drop_table("product_feedback")
    op.drop_table("routine_checkins")

    op.execute("DROP TYPE IF EXISTS notification_type_enum")
    op.execute("DROP TYPE IF EXISTS product_rating_enum")
    op.execute("DROP TYPE IF EXISTS adherence_level_enum")
