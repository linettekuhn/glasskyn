"""add image_s3_key to products

Revision ID: a1b2c3d4e5f6
Revises: 9660ec22fff6
Create Date: 2026-05-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9660ec22fff6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('image_s3_key', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'image_s3_key')