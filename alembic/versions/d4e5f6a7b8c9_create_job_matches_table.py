"""create_job_matches_table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-17 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'job_matches' not in inspector.get_table_names():
        op.create_table(
            'job_matches',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('job_id', sa.String(length=36), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
            sa.Column('match_score', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('position_score', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('skill_score', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('salary_score', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('location_score', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('commute_estimate', sa.String(length=255), nullable=True),
            sa.Column('distance_estimate', sa.String(length=255), nullable=True),
            sa.Column('matched_reasons', sa.JSON(), nullable=True),
            sa.Column('matched_skills', sa.JSON(), nullable=True),
            sa.Column('missing_skills', sa.JSON(), nullable=True),
            sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('is_stale', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'job_id', name='uq_user_job_match')
        )


def downgrade() -> None:
    pass
