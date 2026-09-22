"""add timezone to user_preferences

Revision ID: a910e557a209
Revises: 0a65b8463ae8
Create Date: 2026-08-07 17:05:53.546282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a910e557a209'
down_revision: Union[str, Sequence[str], None] = '0a65b8463ae8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'user_preferences',
        sa.Column('timezone', sa.String(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_preferences', 'timezone')
