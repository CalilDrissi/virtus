"""Add dynamic model categories

Revision ID: 007_add_dynamic_categories
Revises: 006_add_credit_balance
Create Date: 2026-01-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '007_add_dynamic_categories'
down_revision: Union[str, None] = '006_add_credit_balance'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create model_categories table
    op.create_table(
        'model_categories',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('slug', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )

    # Insert default categories
    op.execute("""
        INSERT INTO model_categories (slug, name, description, icon, color, sort_order) VALUES
        ('legal', 'Legal', 'Legal document analysis and assistance', 'DocumentView', 'purple', 1),
        ('healthcare', 'Healthcare', 'Medical and healthcare applications', 'Hospital', 'green', 2),
        ('ecommerce', 'E-Commerce', 'Online retail and shopping assistance', 'ShoppingCart', 'blue', 3),
        ('customer_support', 'Customer Support', 'Customer service and support automation', 'Chat', 'teal', 4),
        ('finance', 'Finance', 'Financial analysis and advisory', 'Currency', 'cyan', 5),
        ('education', 'Education', 'Educational and learning applications', 'Education', 'magenta', 6),
        ('general', 'General', 'General purpose AI models', 'Bot', 'gray', 7)
    """)

    # Change category column from enum to varchar
    # First, alter the column type
    op.execute("""
        ALTER TABLE ai_models
        ALTER COLUMN category TYPE VARCHAR(50)
        USING category::text
    """)

    # Drop the old enum type if it exists
    op.execute("DROP TYPE IF EXISTS modelcategory")


def downgrade() -> None:
    # Recreate the enum type
    op.execute("""
        CREATE TYPE modelcategory AS ENUM (
            'legal', 'healthcare', 'ecommerce', 'customer_support',
            'finance', 'education', 'general'
        )
    """)

    # Change column back to enum
    op.execute("""
        ALTER TABLE ai_models
        ALTER COLUMN category TYPE modelcategory
        USING category::modelcategory
    """)

    # Drop the categories table
    op.drop_table('model_categories')
