"""add_review_ratings_to_sessions

Revision ID: c4d2e8a1f3b5
Revises: a3f7c9e2b5d4
Create Date: 2026-10-07 00:00:00.000000

Adds nullable review columns to sessions so entries saved before the
Review screen keep loading without errors.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4d2e8a1f3b5'
down_revision: Union[str, Sequence[str], None] = 'a3f7c9e2b5d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sessions', sa.Column('moisture_rating', sa.Integer(), nullable=True))
    op.add_column('sessions', sa.Column('texture_rating', sa.Integer(), nullable=True))
    op.add_column('sessions', sa.Column('tone_rating', sa.Integer(), nullable=True))
    op.add_column('sessions', sa.Column('notes', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sessions', 'notes')
    op.drop_column('sessions', 'tone_rating')
    op.drop_column('sessions', 'texture_rating')
    op.drop_column('sessions', 'moisture_rating')
