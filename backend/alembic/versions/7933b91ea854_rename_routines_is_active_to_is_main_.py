"""rename routines is_active to is_main_routine and drop home_routine_id

Revision ID: 7933b91ea854
Revises: a3541b7c0589
Create Date: 2026-08-15 22:22:47.277817

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7933b91ea854'
down_revision: Union[str, Sequence[str], None] = 'a3541b7c0589'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Rename preserves existing data: previously active routines keep their flag.
    op.alter_column(
        'routines',
        'is_active',
        new_column_name='is_main_routine',
        existing_type=sa.Boolean(),
    )

    # Enforce exactly one main routine per (user_id, routine_type):
    # keep only the newest main per group.
    op.execute(
        """
        UPDATE routines SET is_main_routine = FALSE
        WHERE is_main_routine = TRUE
          AND id NOT IN (
            SELECT DISTINCT ON (user_id, routine_type) id
            FROM routines
            WHERE is_main_routine = TRUE
            ORDER BY user_id, routine_type, created_at DESC
          )
        """
    )

    # Promote the newest routine for groups that ended up with no main.
    op.execute(
        """
        UPDATE routines SET is_main_routine = TRUE
        WHERE id IN (
            SELECT DISTINCT ON (user_id, routine_type) id
            FROM routines
            ORDER BY user_id, routine_type, created_at DESC
        )
          AND (user_id, routine_type) IN (
            SELECT user_id, routine_type
            FROM routines
            GROUP BY user_id, routine_type
            HAVING BOOL_OR(is_main_routine) = FALSE
          )
        """
    )

    op.drop_constraint(op.f('fk_user_preferences_home_routine_id_routines'), 'user_preferences', type_='foreignkey')
    op.drop_column('user_preferences', 'home_routine_id')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('user_preferences', sa.Column('home_routine_id', sa.INTEGER(), autoincrement=False, nullable=True))
    op.create_foreign_key(op.f('fk_user_preferences_home_routine_id_routines'), 'user_preferences', 'routines', ['home_routine_id'], ['id'], ondelete='SET NULL')
    op.alter_column(
        'routines',
        'is_main_routine',
        new_column_name='is_active',
        existing_type=sa.Boolean(),
    )
