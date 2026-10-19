"""create employer_messages table

Revision ID: g8h9i0j1k2l3
Revises: f9a8b7c6d5e4
Create Date: 2026-08-18 02:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'g8h9i0j1k2l3'
down_revision: Union[str, None] = 'f9a8b7c6d5e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'employer_messages' not in inspector.get_table_names():
        op.create_table(
            'employer_messages',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('application_id', sa.String(length=36), nullable=True),
            sa.Column('employer_id', sa.String(length=36), nullable=False),
            sa.Column('candidate_id', sa.String(length=36), nullable=False),
            sa.Column('subject', sa.String(length=255), nullable=False),
            sa.Column('body', sa.Text(), nullable=False),
            sa.Column('recipient_email', sa.String(length=255), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['candidate_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['employer_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

def downgrade() -> None:
    pass
