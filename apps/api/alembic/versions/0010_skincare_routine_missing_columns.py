"""Add missing skincare_routine_current columns

The ORM model (app/models/questionnaire.py::SkincareRoutineCurrent) declares
uses_face_mask and uses_nothing, but 0001_initial_schema.py never created
them — this table's columns were evidently patched directly on the old
Tokyo DB by an ad-hoc script and never captured in a migration, so the new
Mumbai DB never got them. Caused 500s on questionnaire submit
(asyncpg.exceptions.UndefinedColumnError: uses_face_mask does not exist).

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0010'
down_revision: Union[str, None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('skincare_routine_current', sa.Column('uses_face_mask', sa.Boolean(), server_default='false'))
    op.add_column('skincare_routine_current', sa.Column('uses_nothing', sa.Boolean(), server_default='false'))


def downgrade() -> None:
    op.drop_column('skincare_routine_current', 'uses_face_mask')
    op.drop_column('skincare_routine_current', 'uses_nothing')
