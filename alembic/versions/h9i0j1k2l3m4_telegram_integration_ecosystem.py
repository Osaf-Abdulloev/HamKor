"""telegram integration ecosystem schema update

Revision ID: h9i0j1k2l3m4
Revises: g8h9i0j1k2l3
Create Date: 2026-08-18 08:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'h9i0j1k2l3m4'
down_revision: Union[str, None] = 'g8h9i0j1k2l3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    users_cols = [c['name'] for c in inspector.get_columns('users')]
    if 'telegram_user_id' not in users_cols:
        op.add_column('users', sa.Column('telegram_user_id', sa.String(length=100), nullable=True))
    if 'telegram_is_verified' not in users_cols:
        op.add_column('users', sa.Column('telegram_is_verified', sa.Boolean(), server_default='false', nullable=False))
    if 'telegram_linked_at' not in users_cols:
        op.add_column('users', sa.Column('telegram_linked_at', sa.DateTime(timezone=True), nullable=True))
    if 'telegram_link_code_expires_at' not in users_cols:
        op.add_column('users', sa.Column('telegram_link_code_expires_at', sa.DateTime(timezone=True), nullable=True))
    if 'telegram_notifications_enabled' not in users_cols:
        op.add_column('users', sa.Column('telegram_notifications_enabled', sa.Boolean(), server_default='true', nullable=False))
    if 'telegram_last_message_at' not in users_cols:
        op.add_column('users', sa.Column('telegram_last_message_at', sa.DateTime(timezone=True), nullable=True))
    if 'telegram_last_promotional_message_at' not in users_cols:
        op.add_column('users', sa.Column('telegram_last_promotional_message_at', sa.DateTime(timezone=True), nullable=True))

    settings_cols = [c['name'] for c in inspector.get_columns('user_settings')]
    if 'telegram_notifications_enabled' not in settings_cols:
        op.add_column('user_settings', sa.Column('telegram_notifications_enabled', sa.Boolean(), server_default='true', nullable=False))
    if 'telegram_job_recommendations_enabled' not in settings_cols:
        op.add_column('user_settings', sa.Column('telegram_job_recommendations_enabled', sa.Boolean(), server_default='true', nullable=False))
    if 'telegram_messages_enabled' not in settings_cols:
        op.add_column('user_settings', sa.Column('telegram_messages_enabled', sa.Boolean(), server_default='true', nullable=False))
    if 'telegram_system_notifications_enabled' not in settings_cols:
        op.add_column('user_settings', sa.Column('telegram_system_notifications_enabled', sa.Boolean(), server_default='true', nullable=False))
    if 'telegram_promotional_enabled' not in settings_cols:
        op.add_column('user_settings', sa.Column('telegram_promotional_enabled', sa.Boolean(), server_default='true', nullable=False))

    if 'telegram_notification_logs' not in inspector.get_table_names():
        op.create_table(
            'telegram_notification_logs',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=True),
            sa.Column('chat_id', sa.String(length=100), nullable=True),
            sa.Column('notification_type', sa.String(length=50), server_default='system', nullable=False),
            sa.Column('channel', sa.String(length=20), server_default='telegram', nullable=False),
            sa.Column('status', sa.String(length=50), server_default='pending', nullable=False),
            sa.Column('message_text', sa.Text(), nullable=False),
            sa.Column('telegram_message_id', sa.String(length=100), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

def downgrade() -> None:
    pass
