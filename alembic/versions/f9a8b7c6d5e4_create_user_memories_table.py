"""create user memories table

Revision ID: f9a8b7c6d5e4
Revises: d4e5f6a7b8c9
Create Date: 2026-08-18 01:18:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f9a8b7c6d5e4'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'user_memories' not in inspector.get_table_names():
        op.create_table(
            'user_memories',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('key', sa.String(length=100), nullable=False),
            sa.Column('value', sa.Text(), nullable=False),
            sa.Column('importance', sa.Integer(), server_default='1', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False)
        )

def downgrade() -> None:
    pass
