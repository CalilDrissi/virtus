"""Add model and subscription data sources join tables

Revision ID: 005_model_subscription_data_sources
Revises: 004_add_custom_provider
Create Date: 2026-01-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '005_data_source_links'
down_revision: Union[str, None] = '004_add_custom_provider'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create model_data_sources join table
    op.create_table(
        'model_data_sources',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('model_id', UUID(as_uuid=True), sa.ForeignKey('ai_models.id', ondelete='CASCADE'), nullable=False),
        sa.Column('data_source_id', UUID(as_uuid=True), sa.ForeignKey('data_sources.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('model_id', 'data_source_id', name='uq_model_data_source'),
    )
    op.create_index('ix_model_data_sources_model_id', 'model_data_sources', ['model_id'])
    op.create_index('ix_model_data_sources_data_source_id', 'model_data_sources', ['data_source_id'])

    # Create subscription_data_sources join table
    op.create_table(
        'subscription_data_sources',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('subscription_id', UUID(as_uuid=True), sa.ForeignKey('subscriptions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('data_source_id', UUID(as_uuid=True), sa.ForeignKey('data_sources.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('subscription_id', 'data_source_id', name='uq_subscription_data_source'),
    )
    op.create_index('ix_subscription_data_sources_subscription_id', 'subscription_data_sources', ['subscription_id'])
    op.create_index('ix_subscription_data_sources_data_source_id', 'subscription_data_sources', ['data_source_id'])


def downgrade() -> None:
    op.drop_table('subscription_data_sources')
    op.drop_table('model_data_sources')
