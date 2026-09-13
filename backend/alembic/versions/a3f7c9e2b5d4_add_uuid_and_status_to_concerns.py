"""add_uuid_and_status_to_concerns

Revision ID: a3f7c9e2b5d4
Revises: b7c9a1d4e2f3
Create Date: 2026-09-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a3f7c9e2b5d4'
down_revision: Union[str, Sequence[str], None] = 'b7c9a1d4e2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('concerns', sa.Column('uuid', sa.String(), nullable=True))
    op.add_column('concerns', sa.Column('status', sa.String(), nullable=True))
    op.create_index(op.f('ix_concerns_uuid'), 'concerns', ['uuid'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_concerns_uuid'), table_name='concerns')
    op.drop_column('concerns', 'status')
    op.drop_column('concerns', 'uuid')