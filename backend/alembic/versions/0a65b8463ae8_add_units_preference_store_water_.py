"""add units preference, store water amounts in ml

Revision ID: 0a65b8463ae8
Revises: 038bf540767a
Create Date: 2026-08-06 21:23:53.970068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0a65b8463ae8'
down_revision: Union[str, Sequence[str], None] = '038bf540767a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OZ_TO_ML = 29.5735


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'user_preferences',
        sa.Column('units', sa.String(), server_default='imperial', nullable=False),
    )
    op.alter_column(
        'user_preferences',
        'water_goal_oz',
        new_column_name='water_goal_ml',
        existing_type=sa.Integer(),
        existing_nullable=True,
    )
    op.execute(
        "UPDATE user_preferences SET water_goal_ml = "
        f"ROUND(water_goal_ml * {OZ_TO_ML})::integer WHERE water_goal_ml IS NOT NULL"
    )
    op.alter_column(
        'water_intakes',
        'oz',
        new_column_name='ml',
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.execute(
        f"UPDATE water_intakes SET ml = ROUND(ml * {OZ_TO_ML})::integer"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        f"UPDATE water_intakes SET ml = ROUND(ml / {OZ_TO_ML})::integer"
    )
    op.alter_column(
        'water_intakes',
        'ml',
        new_column_name='oz',
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.execute(
        "UPDATE user_preferences SET water_goal_ml = "
        f"ROUND(water_goal_ml / {OZ_TO_ML})::integer WHERE water_goal_ml IS NOT NULL"
    )
    op.alter_column(
        'user_preferences',
        'water_goal_ml',
        new_column_name='water_goal_oz',
        existing_type=sa.Integer(),
        existing_nullable=True,
    )
    op.drop_column('user_preferences', 'units')
