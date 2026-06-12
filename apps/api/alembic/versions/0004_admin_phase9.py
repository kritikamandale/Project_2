"""Phase 9 — Admin panel: TOTP support on users table.

Adds totp_secret (nullable) and totp_enabled columns to users.
All other admin tables (platform_settings, audit_logs) already exist.

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("totp_secret", sa.String(64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("totp_enabled", sa.Boolean, server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
