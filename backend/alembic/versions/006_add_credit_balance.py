"""Add credit_balance to organizations

Revision ID: 006_add_credit_balance
Revises: 005_data_source_links
Create Date: 2026-01-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006_add_credit_balance'
down_revision: Union[str, None] = '005_data_source_links'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('credit_balance', sa.Numeric(12, 2), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('organizations', 'credit_balance')
