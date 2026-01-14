"""Add subscription_id to api_keys

Revision ID: 008_add_api_key_subscription_id
Revises: 007_add_dynamic_categories
Create Date: 2026-01-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '008_add_api_key_subscription_id'
down_revision: Union[str, None] = '007_add_dynamic_categories'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'api_keys',
        sa.Column('subscription_id', UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_api_keys_subscription_id',
        'api_keys',
        'subscriptions',
        ['subscription_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_api_keys_subscription_id', 'api_keys', ['subscription_id'])


def downgrade() -> None:
    op.drop_index('ix_api_keys_subscription_id', table_name='api_keys')
    op.drop_constraint('fk_api_keys_subscription_id', 'api_keys', type_='foreignkey')
    op.drop_column('api_keys', 'subscription_id')
