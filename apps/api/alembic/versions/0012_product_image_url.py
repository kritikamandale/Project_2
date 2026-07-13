"""Add product image_url column

Additive only — nullable, existing rows keep working untouched. The frontend
falls back to a category icon when NULL.

  image_url   product photo shown on cards (resolved from the brand's own
              product page og:image where reachable)

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0012'
down_revision: Union[str, None] = '0011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('image_url', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'image_url')
