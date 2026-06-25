"""Add Phase 6 recommendation columns

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-20 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0008'
down_revision: Union[str, None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # recommendations table additions
    op.add_column('recommendations', sa.Column('skin_score', sa.Float(), nullable=True))
    op.add_column('recommendations', sa.Column('confidence_score', sa.Float(), nullable=True))
    op.add_column('recommendations', sa.Column('estimated_monthly_cost_inr', sa.Float(), nullable=True))
    op.add_column('recommendations', sa.Column('roadmap_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('recommendations', sa.Column('allergen_flags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('recommendations', sa.Column('requires_derm_review', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('recommendations', sa.Column('feedback_rating', sa.Integer(), nullable=True))
    op.add_column('recommendations', sa.Column('feedback_text', sa.Text(), nullable=True))
    op.add_column('recommendations', sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # recommendation_products table additions
    op.add_column('recommendation_products', sa.Column('highlighted_ingredient', sa.String(length=100), nullable=True))
    op.add_column('recommendation_products', sa.Column('usage_instruction', sa.Text(), nullable=True))
    op.add_column('recommendation_products', sa.Column('time_of_day', sa.String(length=20), nullable=True))

def downgrade() -> None:
    op.drop_column('recommendation_products', 'time_of_day')
    op.drop_column('recommendation_products', 'usage_instruction')
    op.drop_column('recommendation_products', 'highlighted_ingredient')

    op.drop_column('recommendations', 'metadata_json')
    op.drop_column('recommendations', 'feedback_text')
    op.drop_column('recommendations', 'feedback_rating')
    op.drop_column('recommendations', 'requires_derm_review')
    op.drop_column('recommendations', 'allergen_flags')
    op.drop_column('recommendations', 'roadmap_json')
    op.drop_column('recommendations', 'estimated_monthly_cost_inr')
    op.drop_column('recommendations', 'confidence_score')
    op.drop_column('recommendations', 'skin_score')
