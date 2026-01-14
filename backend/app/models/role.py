import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, UniqueConstraint, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.team import TeamPermission  # Reuse the same permission enum


class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="roles")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    model_access = relationship("RoleModelAccess", back_populates="role", cascade="all, delete-orphan")
    data_source_access = relationship("RoleDataSourceAccess", back_populates="role", cascade="all, delete-orphan")
    users = relationship("User", back_populates="custom_role")

    def __repr__(self):
        return f"<Role {self.name}>"


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint('role_id', 'permission', name='uq_role_permission'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission = Column(Enum(TeamPermission), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    role = relationship("Role", back_populates="permissions")

    def __repr__(self):
        return f"<RolePermission role={self.role_id} permission={self.permission}>"


class RoleModelAccess(Base):
    __tablename__ = "role_model_access"
    __table_args__ = (
        UniqueConstraint('role_id', 'model_id', name='uq_role_model'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    role = relationship("Role", back_populates="model_access")
    model = relationship("AIModel")

    def __repr__(self):
        return f"<RoleModelAccess role={self.role_id} model={self.model_id}>"


class RoleDataSourceAccess(Base):
    __tablename__ = "role_data_source_access"
    __table_args__ = (
        UniqueConstraint('role_id', 'data_source_id', name='uq_role_data_source'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    data_source_id = Column(UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    role = relationship("Role", back_populates="data_source_access")
    data_source = relationship("DataSource")

    def __repr__(self):
        return f"<RoleDataSourceAccess role={self.role_id} data_source={self.data_source_id}>"
