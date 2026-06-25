"""Add missing questionnaire columns

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-20 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0007'
down_revision: Union[str, None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing columns to questionnaire_responses
    op.add_column('questionnaire_responses', sa.Column('sleep_consistency', sa.Boolean(), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('sugar_consumption', sa.String(length=20), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('dairy_consumption', sa.String(length=20), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('stress_source', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('work_environment', sa.String(length=30), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('pollution_exposure', sa.String(length=30), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('cleanser_frequency', sa.String(length=30), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('sunscreen_use', sa.String(length=20), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('diagnosed_conditions', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('medication_affects_skin', sa.Boolean(), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('medication_name_text', sa.Text(), nullable=True))
    op.add_column('questionnaire_responses', sa.Column('questionnaire_version', sa.Integer(), nullable=True))
    
    # Update existing records to version 2
    op.execute("UPDATE questionnaire_responses SET questionnaire_version = 2 WHERE questionnaire_version IS NULL")

def downgrade() -> None:
    op.drop_column('questionnaire_responses', 'sleep_consistency')
    op.drop_column('questionnaire_responses', 'sugar_consumption')
    op.drop_column('questionnaire_responses', 'dairy_consumption')
    op.drop_column('questionnaire_responses', 'stress_source')
    op.drop_column('questionnaire_responses', 'work_environment')
    op.drop_column('questionnaire_responses', 'pollution_exposure')
    op.drop_column('questionnaire_responses', 'cleanser_frequency')
    op.drop_column('questionnaire_responses', 'sunscreen_use')
    op.drop_column('questionnaire_responses', 'diagnosed_conditions')
    op.drop_column('questionnaire_responses', 'medication_affects_skin')
    op.drop_column('questionnaire_responses', 'medication_name_text')
    op.drop_column('questionnaire_responses', 'questionnaire_version')
