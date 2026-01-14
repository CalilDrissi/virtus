import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class TeamRole(str, PyEnum):
    ADMIN = "admin"
    MEMBER = "member"


class TeamPermission(str, PyEnum):
    MODEL_ACCESS = "model_access"
    DATA_SOURCE_ACCESS = "data_source_access"
    BILLING_VIEW = "billing_view"
    API_KEY_MANAGEMENT = "api_key_management"


class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="teams")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    permissions = relationship("TeamPermissionGrant", back_populates="team", cascade="all, delete-orphan")
    model_access = relationship("TeamModelAccess", back_populates="team", cascade="all, delete-orphan")
    data_source_access = relationship("TeamDataSourceAccess", back_populates="team", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Team {self.name}>"


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint('team_id', 'user_id', name='uq_team_member'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(TeamRole), default=TeamRole.MEMBER, nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], back_populates="team_memberships")
    inviter = relationship("User", foreign_keys=[invited_by])

    def __repr__(self):
        return f"<TeamMember team={self.team_id} user={self.user_id}>"


class TeamPermissionGrant(Base):
    __tablename__ = "team_permission_grants"
    __table_args__ = (
        UniqueConstraint('team_id', 'permission', name='uq_team_permission'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    permission = Column(Enum(TeamPermission), nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="permissions")
    granter = relationship("User")

    def __repr__(self):
        return f"<TeamPermissionGrant team={self.team_id} permission={self.permission}>"


class TeamModelAccess(Base):
    __tablename__ = "team_model_access"
    __table_args__ = (
        UniqueConstraint('team_id', 'model_id', name='uq_team_model'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id", ondelete="CASCADE"), nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="model_access")
    model = relationship("AIModel")
    granter = relationship("User")

    def __repr__(self):
        return f"<TeamModelAccess team={self.team_id} model={self.model_id}>"


class TeamDataSourceAccess(Base):
    __tablename__ = "team_data_source_access"
    __table_args__ = (
        UniqueConstraint('team_id', 'data_source_id', name='uq_team_data_source'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    data_source_id = Column(UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="data_source_access")
    data_source = relationship("DataSource")
    granter = relationship("User")

    def __repr__(self):
        return f"<TeamDataSourceAccess team={self.team_id} data_source={self.data_source_id}>"
