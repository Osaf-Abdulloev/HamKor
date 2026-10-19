"""add_external_vacancy_raw_data_and_timestamps

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-17 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('jobs')]

    if 'raw_data' not in cols:
        op.add_column('jobs', sa.Column('raw_data', sa.JSON(), nullable=True))
    if 'published_at' not in cols:
        op.add_column('jobs', sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))
    if 'first_seen_at' not in cols:
        op.add_column('jobs', sa.Column('first_seen_at', sa.DateTime(timezone=True), nullable=True))
    if 'last_seen_at' not in cols:
        op.add_column('jobs', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
    if 'job_group_id' not in cols:
        op.add_column('jobs', sa.Column('job_group_id', sa.String(length=100), nullable=True))


def downgrade() -> None:
    pass
