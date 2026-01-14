"""Add team management tables

Revision ID: 001_add_team_tables
Revises:
Create Date: 2026-01-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_team_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create teamrole enum
    teamrole_enum = postgresql.ENUM('admin', 'member', name='teamrole', create_type=False)
    teamrole_enum.create(op.get_bind(), checkfirst=True)

    # Create teampermission enum
    teampermission_enum = postgresql.ENUM(
        'model_access', 'data_source_access', 'billing_view', 'api_key_management',
        name='teampermission', create_type=False
    )
    teampermission_enum.create(op.get_bind(), checkfirst=True)

    # Create teams table
    op.create_table(
        'teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_teams_organization_id', 'teams', ['organization_id'])

    # Create team_members table
    op.create_table(
        'team_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', postgresql.ENUM('admin', 'member', name='teamrole', create_type=False), nullable=False, server_default='member'),
        sa.Column('invited_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('joined_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('team_id', 'user_id', name='uq_team_member'),
    )
    op.create_index('ix_team_members_team_id', 'team_members', ['team_id'])
    op.create_index('ix_team_members_user_id', 'team_members', ['user_id'])

    # Create team_permission_grants table
    op.create_table(
        'team_permission_grants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission', postgresql.ENUM('model_access', 'data_source_access', 'billing_view', 'api_key_management', name='teampermission', create_type=False), nullable=False),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('granted_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('team_id', 'permission', name='uq_team_permission'),
    )
    op.create_index('ix_team_permission_grants_team_id', 'team_permission_grants', ['team_id'])

    # Create team_model_access table
    op.create_table(
        'team_model_access',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_models.id', ondelete='CASCADE'), nullable=False),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('granted_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('team_id', 'model_id', name='uq_team_model'),
    )
    op.create_index('ix_team_model_access_team_id', 'team_model_access', ['team_id'])
    op.create_index('ix_team_model_access_model_id', 'team_model_access', ['model_id'])

    # Create team_data_source_access table
    op.create_table(
        'team_data_source_access',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('data_source_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_sources.id', ondelete='CASCADE'), nullable=False),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('granted_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('team_id', 'data_source_id', name='uq_team_data_source'),
    )
    op.create_index('ix_team_data_source_access_team_id', 'team_data_source_access', ['team_id'])
    op.create_index('ix_team_data_source_access_data_source_id', 'team_data_source_access', ['data_source_id'])


def downgrade() -> None:
    op.drop_table('team_data_source_access')
    op.drop_table('team_model_access')
    op.drop_table('team_permission_grants')
    op.drop_table('team_members')
    op.drop_table('teams')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS teampermission')
    op.execute('DROP TYPE IF EXISTS teamrole')
