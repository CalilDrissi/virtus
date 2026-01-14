from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.team import TeamPermission


# Role schemas
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permissions: List[TeamPermission] = []
    model_ids: List[UUID] = []
    data_source_ids: List[UUID] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[TeamPermission]] = None
    model_ids: Optional[List[UUID]] = None
    data_source_ids: Optional[List[UUID]] = None


class RoleModelAccessResponse(BaseModel):
    model_id: UUID
    model_name: str
    model_slug: str

    class Config:
        from_attributes = True


class RoleDataSourceAccessResponse(BaseModel):
    data_source_id: UUID
    data_source_name: str

    class Config:
        from_attributes = True


class RoleResponse(RoleBase):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime
    permissions: List[TeamPermission] = []
    model_access: List[RoleModelAccessResponse] = []
    data_source_access: List[RoleDataSourceAccessResponse] = []
    user_count: int = 0

    class Config:
        from_attributes = True


class RoleListResponse(RoleBase):
    id: UUID
    organization_id: UUID
    created_at: datetime
    permissions: List[TeamPermission] = []
    user_count: int = 0

    class Config:
        from_attributes = True


# User role assignment
class UserRoleAssign(BaseModel):
    role_id: Optional[UUID] = None  # None to remove role
