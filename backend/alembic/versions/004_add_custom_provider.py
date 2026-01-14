"""Add custom provider to aiprovider enum

Revision ID: add_custom_provider
Revises: add_avatar_url_to_users
Create Date: 2026-01-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_add_custom_provider'
down_revision: Union[str, None] = '003_add_avatar_url'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'custom' to the aiprovider enum
    op.execute("ALTER TYPE aiprovider ADD VALUE IF NOT EXISTS 'custom'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values directly
    # This would require recreating the type and all columns using it
    pass
