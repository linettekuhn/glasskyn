"""add per-user am and pm routine digest times

Revision ID: cdf7657b99a9
Revises: e9925c4b83ba
Create Date: 2026-08-04 20:17:49.681223

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cdf7657b99a9'
down_revision: Union[str, Sequence[str], None] = 'e9925c4b83ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user_preferences', sa.Column('routine_digest_am_time', sa.String(), nullable=True))
    op.add_column('user_preferences', sa.Column('routine_digest_pm_time', sa.String(), nullable=True))
    op.execute(
        "UPDATE user_preferences SET routine_digest_am_time = '08:00', "
        "routine_digest_pm_time = '20:00' WHERE routine_digest_enabled = TRUE"
    )
    op.drop_column('user_preferences', 'routine_digest_enabled')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('user_preferences', sa.Column('routine_digest_enabled', sa.BOOLEAN(), autoincrement=False, nullable=True))
    op.execute(
        "UPDATE user_preferences SET routine_digest_enabled = "
        "(routine_digest_am_time IS NOT NULL OR routine_digest_pm_time IS NOT NULL)"
    )
    op.alter_column('user_preferences', 'routine_digest_enabled', existing_type=sa.BOOLEAN(), nullable=False)
    op.drop_column('user_preferences', 'routine_digest_pm_time')
    op.drop_column('user_preferences', 'routine_digest_am_time')
