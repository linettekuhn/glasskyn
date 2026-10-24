"""add_skin_tracking_tables

Revision ID: b7c9a1d4e2f3
Revises: fe1f4f9f01f1
Create Date: 2026-09-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7c9a1d4e2f3'
down_revision: Union[str, Sequence[str], None] = 'fe1f4f9f01f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('image_url', sa.String(), nullable=False),
    sa.Column('face_landmarks', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sessions_id'), 'sessions', ['id'], unique=False)
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'], unique=False)
    op.create_table('concerns',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(), nullable=True),
    sa.Column('created_session_id', sa.Integer(), nullable=False),
    sa.Column('resolved_session_id', sa.Integer(), nullable=True),
    sa.Column('anchor', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('history', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['created_session_id'], ['sessions.id'], ),
    sa.ForeignKeyConstraint(['resolved_session_id'], ['sessions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_concerns_id'), 'concerns', ['id'], unique=False)
    op.create_index(op.f('ix_concerns_created_session_id'), 'concerns', ['created_session_id'], unique=False)
    op.create_index(op.f('ix_concerns_resolved_session_id'), 'concerns', ['resolved_session_id'], unique=False)
    op.create_index(op.f('ix_concerns_user_id'), 'concerns', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_concerns_user_id'), table_name='concerns')
    op.drop_index(op.f('ix_concerns_resolved_session_id'), table_name='concerns')
    op.drop_index(op.f('ix_concerns_created_session_id'), table_name='concerns')
    op.drop_index(op.f('ix_concerns_id'), table_name='concerns')
    op.drop_table('concerns')
    op.drop_index(op.f('ix_sessions_user_id'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_id'), table_name='sessions')
    op.drop_table('sessions')