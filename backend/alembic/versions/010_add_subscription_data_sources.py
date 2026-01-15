"""Add subscription_id to data_sources for user-specific data sources

Revision ID: 010_add_subscription_data_sources
Revises: 009_model_specific_data_sources
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009_model_specific_data_sources'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Check if subscription_id column already exists
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='data_sources' AND column_name='subscription_id'
    """))
    if result.fetchone() is None:
        # Add subscription_id column to data_sources (nullable - if null, it's a model-level source)
        op.add_column('data_sources', sa.Column('subscription_id', postgresql.UUID(as_uuid=True), nullable=True))

        # Add foreign key constraint
        op.create_foreign_key(
            'fk_data_sources_subscription_id',
            'data_sources', 'subscriptions',
            ['subscription_id'], ['id'],
            ondelete='CASCADE'
        )

        # Create index for faster lookups
        op.create_index('ix_data_sources_subscription_id', 'data_sources', ['subscription_id'])


def downgrade() -> None:
    conn = op.get_bind()

    # Check if subscription_id column exists
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='data_sources' AND column_name='subscription_id'
    """))
    if result.fetchone() is not None:
        # Drop index
        op.drop_index('ix_data_sources_subscription_id', table_name='data_sources')

        # Drop foreign key constraint
        result = conn.execute(sa.text("""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name='data_sources' AND constraint_type='FOREIGN KEY'
            AND constraint_name LIKE '%subscription%'
        """))
        constraint = result.fetchone()
        if constraint:
            op.drop_constraint(constraint[0], 'data_sources', type_='foreignkey')

        # Drop column
        op.drop_column('data_sources', 'subscription_id')
