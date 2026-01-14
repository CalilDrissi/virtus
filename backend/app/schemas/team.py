from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.team import TeamRole, TeamPermission


# Team schemas
class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TeamResponse(TeamBase):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    permissions: List[TeamPermission] = []

    class Config:
        from_attributes = True


class TeamDetailResponse(TeamResponse):
    members: List["TeamMemberResponse"] = []
    model_access: List["TeamModelAccessResponse"] = []
    data_source_access: List["TeamDataSourceAccessResponse"] = []


# Team member schemas
class TeamMemberBase(BaseModel):
    role: TeamRole = TeamRole.MEMBER


class TeamMemberAdd(BaseModel):
    email: EmailStr
    role: TeamRole = TeamRole.MEMBER


class TeamMemberUpdate(BaseModel):
    role: TeamRole


class TeamMemberResponse(TeamMemberBase):
    id: UUID
    team_id: UUID
    user_id: UUID
    invited_by: Optional[UUID]
    joined_at: datetime
    user_email: str
    user_full_name: Optional[str]

    class Config:
        from_attributes = True


# Team permission schemas
class TeamPermissionsUpdate(BaseModel):
    permissions: List[TeamPermission]


class TeamPermissionsResponse(BaseModel):
    team_id: UUID
    permissions: List[TeamPermission]


# Team model access schemas
class TeamModelAccessUpdate(BaseModel):
    model_ids: List[UUID]


class TeamModelAccessResponse(BaseModel):
    id: UUID
    team_id: UUID
    model_id: UUID
    model_name: str
    model_slug: str
    granted_at: datetime

    class Config:
        from_attributes = True


# Team data source access schemas
class TeamDataSourceAccessUpdate(BaseModel):
    data_source_ids: List[UUID]


class TeamDataSourceAccessResponse(BaseModel):
    id: UUID
    team_id: UUID
    data_source_id: UUID
    data_source_name: str
    granted_at: datetime

    class Config:
        from_attributes = True


# Rebuild models for forward references
TeamDetailResponse.model_rebuild()
