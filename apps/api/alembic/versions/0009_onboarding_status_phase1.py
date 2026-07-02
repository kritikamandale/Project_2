"""Add users.onboarding_status for the gated first-time onboarding flow

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-02 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0009'
down_revision: Union[str, None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

onboarding_status_enum = sa.Enum(
    "not_started", "questionnaire_done", "scan_done", "completed",
    name="onboarding_status_enum",
)


def upgrade() -> None:
    bind = op.get_bind()
    onboarding_status_enum.create(bind, checkfirst=True)
    op.add_column(
        "users",
        sa.Column(
            "onboarding_status",
            onboarding_status_enum,
            server_default="not_started",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "onboarding_status")
    onboarding_status_enum.drop(op.get_bind(), checkfirst=True)
