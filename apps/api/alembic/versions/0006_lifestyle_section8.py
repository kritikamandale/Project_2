"""Phase 11 — Section 8 lifestyle JSONB column on questionnaire_responses.

Adds extra_lifestyle JSONB column to store spicy/junk food frequency,
fruits & veggies intake, bedtime, phone-before-bed, sleep environment,
sun exposure, smoking, and alcohol data from the new Section 8 questionnaire.

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "questionnaire_responses",
        sa.Column("extra_lifestyle", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("questionnaire_responses", "extra_lifestyle")
