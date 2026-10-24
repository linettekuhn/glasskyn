"""add_skin_nudges_and_nudge_preference

Revision ID: d4e5f6a7b8c9
Revises: c4d2e8a1f3b5
Create Date: 2026-10-08 00:00:00.000000

Creates the skin_nudges table (one in-app nudge per check-in session,
unique on user+session) and adds user_preferences.skin_nudge_enabled.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c4d2e8a1f3b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'skin_nudges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dismissed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'session_id', name='uq_skin_nudges_user_session'),
    )
    op.create_index(op.f('ix_skin_nudges_id'), 'skin_nudges', ['id'], unique=False)
    op.create_index(op.f('ix_skin_nudges_session_id'), 'skin_nudges', ['session_id'], unique=False)
    op.create_index(op.f('ix_skin_nudges_user_id'), 'skin_nudges', ['user_id'], unique=False)
    op.add_column(
        'user_preferences',
        sa.Column('skin_nudge_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_preferences', 'skin_nudge_enabled')
    op.drop_index(op.f('ix_skin_nudges_user_id'), table_name='skin_nudges')
    op.drop_index(op.f('ix_skin_nudges_session_id'), table_name='skin_nudges')
    op.drop_index(op.f('ix_skin_nudges_id'), table_name='skin_nudges')
    op.drop_table('skin_nudges')
