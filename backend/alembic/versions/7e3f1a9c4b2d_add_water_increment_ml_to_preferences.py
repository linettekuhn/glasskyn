"""add water_increment_ml to user preferences

Revision ID: 7e3f1a9c4b2d
Revises: d4e5f6a7b8c9
Create Date: 2026-10-08 00:00:00.000000

Adds a nullable user_preferences.water_increment_ml column (per-tap add
amount in ml). Purely additive: nullable with no backfill, safe against
existing production data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e3f1a9c4b2d'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'user_preferences',
        sa.Column('water_increment_ml', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_preferences', 'water_increment_ml')
