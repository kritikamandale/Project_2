"""Add product intelligence columns (results-page v2)

Additive only — every new column is nullable or has a server default, so
existing rows and the existing recommendation engine keep working untouched.

  brand_display   free-text marketing brand (Re'equil, CeraVe, Bioderma…)
  mrp_inr         list/MRP price → discount % vs price_inr
  pack_size       1 = single, 2/3 = combo (default 1)
  store_links     JSONB [{store,url}] multi-store buy links (default [])
  key_actives     JSONB [str] normalised actives (default [])
  pregnancy_safe  bool | NULL (NULL = unknown)
  is_new          manual "newly added" flag (default false)

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0011'
down_revision: Union[str, None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('brand_display', sa.String(length=120), nullable=True))
    op.add_column('products', sa.Column('mrp_inr', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('pack_size', sa.Integer(), server_default='1', nullable=False))
    op.add_column('products', sa.Column('store_links', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=True))
    op.add_column('products', sa.Column('key_actives', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=True))
    op.add_column('products', sa.Column('pregnancy_safe', sa.Boolean(), nullable=True))
    op.add_column('products', sa.Column('is_new', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('products', 'is_new')
    op.drop_column('products', 'pregnancy_safe')
    op.drop_column('products', 'key_actives')
    op.drop_column('products', 'store_links')
    op.drop_column('products', 'pack_size')
    op.drop_column('products', 'mrp_inr')
    op.drop_column('products', 'brand_display')
