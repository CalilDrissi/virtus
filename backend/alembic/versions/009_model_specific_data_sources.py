"""Make data sources model-specific instead of organization-wide

Revision ID: 009
Revises: 008
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_model_specific_data_sources'
down_revision = '008_add_api_key_subscription_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Check if model_id column already exists
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='data_sources' AND column_name='model_id'
    """))
    model_id_exists = result.fetchone() is not None

    if not model_id_exists:
        # Add model_id column to data_sources
        op.add_column('data_sources', sa.Column('model_id', postgresql.UUID(as_uuid=True), nullable=True))

        # Add foreign key constraint
        op.create_foreign_key(
            'fk_data_sources_model_id',
            'data_sources', 'ai_models',
            ['model_id'], ['id'],
            ondelete='CASCADE'
        )

    # Check if model_data_sources table exists and migrate data
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'model_data_sources'
        )
    """))
    if result.scalar():
        # Migrate existing data: link data sources to models via the model_data_sources table
        op.execute("""
            UPDATE data_sources ds
            SET model_id = mds.model_id
            FROM model_data_sources mds
            WHERE ds.id = mds.data_source_id
        """)
        # Drop the model_data_sources join table (no longer needed)
        op.drop_table('model_data_sources')

    # Check if subscription_data_sources table exists
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'subscription_data_sources'
        )
    """))
    if result.scalar():
        # Drop the subscription_data_sources join table (no longer needed)
        op.drop_table('subscription_data_sources')

    # Make model_id NOT NULL after migration (data sources without a model will be deleted)
    op.execute("DELETE FROM data_sources WHERE model_id IS NULL")
    op.alter_column('data_sources', 'model_id', nullable=False)

    # Check if organization_id column exists in data_sources
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='data_sources' AND column_name='organization_id'
    """))
    if result.fetchone() is not None:
        # Find and drop the foreign key constraint for organization_id
        result = conn.execute(sa.text("""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name='data_sources' AND constraint_type='FOREIGN KEY'
            AND constraint_name LIKE '%organization%'
        """))
        constraint = result.fetchone()
        if constraint:
            op.drop_constraint(constraint[0], 'data_sources', type_='foreignkey')

        # Drop the column
        op.drop_column('data_sources', 'organization_id')

    # Check if organization_id column exists in documents
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='documents' AND column_name='organization_id'
    """))
    if result.fetchone() is not None:
        # Find and drop the foreign key constraint for organization_id
        result = conn.execute(sa.text("""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name='documents' AND constraint_type='FOREIGN KEY'
            AND constraint_name LIKE '%organization%'
        """))
        constraint = result.fetchone()
        if constraint:
            op.drop_constraint(constraint[0], 'documents', type_='foreignkey')

        # Drop the column
        op.drop_column('documents', 'organization_id')


def downgrade() -> None:
    conn = op.get_bind()

    # Check if organization_id column exists in documents
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='documents' AND column_name='organization_id'
    """))
    if result.fetchone() is None:
        # Add back organization_id to documents
        op.add_column('documents', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'documents_organization_id_fkey',
            'documents', 'organizations',
            ['organization_id'], ['id'],
            ondelete='CASCADE'
        )

    # Check if organization_id column exists in data_sources
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='data_sources' AND column_name='organization_id'
    """))
    if result.fetchone() is None:
        # Add back organization_id to data_sources
        op.add_column('data_sources', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'data_sources_organization_id_fkey',
            'data_sources', 'organizations',
            ['organization_id'], ['id'],
            ondelete='CASCADE'
        )

    # Check if subscription_data_sources table exists
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'subscription_data_sources'
        )
    """))
    if not result.scalar():
        # Recreate subscription_data_sources table
        op.create_table(
            'subscription_data_sources',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('subscription_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subscriptions.id', ondelete='CASCADE'), nullable=False),
            sa.Column('data_source_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_sources.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    # Check if model_data_sources table exists
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'model_data_sources'
        )
    """))
    if not result.scalar():
        # Recreate model_data_sources table
        op.create_table(
            'model_data_sources',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_models.id', ondelete='CASCADE'), nullable=False),
            sa.Column('data_source_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_sources.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    # Check if model_id column exists
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='data_sources' AND column_name='model_id'
    """))
    if result.fetchone() is not None:
        # Drop model_id foreign key constraint
        result = conn.execute(sa.text("""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name='data_sources' AND constraint_type='FOREIGN KEY'
            AND constraint_name LIKE '%model%'
        """))
        constraint = result.fetchone()
        if constraint:
            op.drop_constraint(constraint[0], 'data_sources', type_='foreignkey')

        # Drop model_id from data_sources
        op.drop_column('data_sources', 'model_id')
