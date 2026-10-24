"""add spf tracking columns and applications log

Revision ID: a8f4c1d2e6b3
Revises: 7e3f1a9c4b2d
Create Date: 2026-10-12 00:00:00.000000

Adds SPF countdown-tile state to user_preferences (all nullable except
the reminder toggle, which defaults true) plus an append-only
spf_applications log table feeding the "N today" count. Purely additive:
no backfill, no data changes, safe against existing production data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8f4c1d2e6b3'
down_revision: Union[str, Sequence[str], None] = '7e3f1a9c4b2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'user_preferences',
        sa.Column('spf_last_applied_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'user_preferences',
        sa.Column('spf_interval_min', sa.Integer(), nullable=True),
    )
    op.add_column(
        'user_preferences',
        sa.Column('spf_window_start', sa.String(), nullable=True),
    )
    op.add_column(
        'user_preferences',
        sa.Column('spf_window_end', sa.String(), nullable=True),
    )
    op.add_column(
        'user_preferences',
        sa.Column(
            'spf_reminder_enabled',
            sa.Boolean(),
            server_default=sa.text('true'),
            nullable=False,
        ),
    )
    op.add_column(
        'user_preferences',
        sa.Column('spf_indoors_date', sa.String(), nullable=True),
    )
    op.create_table(
        'spf_applications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_spf_applications_id'), 'spf_applications', ['id'], unique=False)
    op.create_index(op.f('ix_spf_applications_user_id'), 'spf_applications', ['user_id'], unique=False)
    op.create_index(op.f('ix_spf_applications_applied_at'), 'spf_applications', ['applied_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_spf_applications_applied_at'), table_name='spf_applications')
    op.drop_index(op.f('ix_spf_applications_user_id'), table_name='spf_applications')
    op.drop_index(op.f('ix_spf_applications_id'), table_name='spf_applications')
    op.drop_table('spf_applications')
    op.drop_column('user_preferences', 'spf_indoors_date')
    op.drop_column('user_preferences', 'spf_reminder_enabled')
    op.drop_column('user_preferences', 'spf_window_end')
    op.drop_column('user_preferences', 'spf_window_start')
    op.drop_column('user_preferences', 'spf_interval_min')
    op.drop_column('user_preferences', 'spf_last_applied_at')
