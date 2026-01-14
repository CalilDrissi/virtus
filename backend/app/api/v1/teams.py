from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.team import Team, TeamMember, TeamPermissionGrant, TeamModelAccess, TeamDataSourceAccess, TeamRole, TeamPermission
from app.models.ai_model import AIModel
from app.models.data_source import DataSource
from app.models.subscription import Subscription
from app.schemas.team import (
    TeamCreate, TeamUpdate, TeamResponse, TeamDetailResponse,
    TeamMemberAdd, TeamMemberUpdate, TeamMemberResponse,
    TeamPermissionsUpdate, TeamPermissionsResponse,
    TeamModelAccessUpdate, TeamModelAccessResponse,
    TeamDataSourceAccessUpdate, TeamDataSourceAccessResponse,
)
from app.api.deps import get_current_user, CurrentUser, require_org_admin

router = APIRouter(prefix="/teams", tags=["Teams"])


# Helper functions
async def get_team_or_404(db: AsyncSession, team_id: UUID, org_id: UUID) -> Team:
    """Get team by ID within organization or raise 404"""
    result = await db.execute(
        select(Team).where(Team.id == team_id, Team.organization_id == org_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


async def check_team_admin_access(db: AsyncSession, team: Team, current_user: CurrentUser) -> bool:
    """Check if current user has admin access to the team"""
    # Org owners and admins always have access
    if current_user.user and current_user.user.role in ["owner", "admin"]:
        return True

    # Check if user is a team admin
    if current_user.user:
        result = await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team.id,
                TeamMember.user_id == current_user.user_id,
                TeamMember.role == TeamRole.ADMIN,
            )
        )
        if result.scalar_one_or_none():
            return True

    return False


def build_team_response(team: Team, member_count: int, permissions: List[TeamPermission]) -> TeamResponse:
    """Build TeamResponse from team entity"""
    return TeamResponse(
        id=team.id,
        organization_id=team.organization_id,
        name=team.name,
        description=team.description,
        created_at=team.created_at,
        updated_at=team.updated_at,
        member_count=member_count,
        permissions=permissions,
    )


# Team CRUD endpoints
@router.get("", response_model=List[TeamResponse])
async def list_teams(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all teams in the organization"""
    # Get teams with member counts
    result = await db.execute(
        select(
            Team,
            func.count(TeamMember.id).label("member_count"),
        )
        .outerjoin(TeamMember, Team.id == TeamMember.team_id)
        .where(Team.organization_id == current_user.org_id)
        .group_by(Team.id)
        .order_by(Team.created_at.desc())
    )
    teams_data = result.all()

    # Get permissions for each team
    team_ids = [t[0].id for t in teams_data]
    if team_ids:
        perm_result = await db.execute(
            select(TeamPermissionGrant).where(TeamPermissionGrant.team_id.in_(team_ids))
        )
        permissions_by_team = {}
        for perm in perm_result.scalars().all():
            if perm.team_id not in permissions_by_team:
                permissions_by_team[perm.team_id] = []
            permissions_by_team[perm.team_id].append(perm.permission)
    else:
        permissions_by_team = {}

    return [
        build_team_response(team, member_count, permissions_by_team.get(team.id, []))
        for team, member_count in teams_data
    ]


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new team"""
    team = Team(
        organization_id=current_user.org_id,
        name=data.name,
        description=data.description,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)

    return build_team_response(team, 0, [])


@router.get("/{team_id}", response_model=TeamDetailResponse)
async def get_team(
    team_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get team details with members, permissions, and access"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    # Get members with user info
    members_result = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.joined_at.desc())
    )
    members = [
        TeamMemberResponse(
            id=tm.id,
            team_id=tm.team_id,
            user_id=tm.user_id,
            role=tm.role,
            invited_by=tm.invited_by,
            joined_at=tm.joined_at,
            user_email=user.email,
            user_full_name=user.full_name,
        )
        for tm, user in members_result.all()
    ]

    # Get permissions
    perm_result = await db.execute(
        select(TeamPermissionGrant).where(TeamPermissionGrant.team_id == team_id)
    )
    permissions = [p.permission for p in perm_result.scalars().all()]

    # Get model access with model info
    model_result = await db.execute(
        select(TeamModelAccess, AIModel)
        .join(AIModel, TeamModelAccess.model_id == AIModel.id)
        .where(TeamModelAccess.team_id == team_id)
    )
    model_access = [
        TeamModelAccessResponse(
            id=tma.id,
            team_id=tma.team_id,
            model_id=tma.model_id,
            model_name=model.name,
            model_slug=model.slug,
            granted_at=tma.granted_at,
        )
        for tma, model in model_result.all()
    ]

    # Get data source access with data source info
    ds_result = await db.execute(
        select(TeamDataSourceAccess, DataSource)
        .join(DataSource, TeamDataSourceAccess.data_source_id == DataSource.id)
        .where(TeamDataSourceAccess.team_id == team_id)
    )
    data_source_access = [
        TeamDataSourceAccessResponse(
            id=tdsa.id,
            team_id=tdsa.team_id,
            data_source_id=tdsa.data_source_id,
            data_source_name=ds.name,
            granted_at=tdsa.granted_at,
        )
        for tdsa, ds in ds_result.all()
    ]

    return TeamDetailResponse(
        id=team.id,
        organization_id=team.organization_id,
        name=team.name,
        description=team.description,
        created_at=team.created_at,
        updated_at=team.updated_at,
        member_count=len(members),
        permissions=permissions,
        members=members,
        model_access=model_access,
        data_source_access=data_source_access,
    )


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: UUID,
    data: TeamUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update team name/description"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    if not await check_team_admin_access(db, team, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)

    await db.commit()
    await db.refresh(team)

    # Get member count and permissions for response
    count_result = await db.execute(
        select(func.count(TeamMember.id)).where(TeamMember.team_id == team_id)
    )
    member_count = count_result.scalar() or 0

    perm_result = await db.execute(
        select(TeamPermissionGrant).where(TeamPermissionGrant.team_id == team_id)
    )
    permissions = [p.permission for p in perm_result.scalars().all()]

    return build_team_response(team, member_count, permissions)


@router.delete("/{team_id}")
async def delete_team(
    team_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a team"""
    team = await get_team_or_404(db, team_id, current_user.org_id)
    await db.delete(team)
    await db.commit()
    return {"message": "Team deleted"}


# Team member endpoints
@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    team_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all members of a team"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    result = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.joined_at.desc())
    )

    return [
        TeamMemberResponse(
            id=tm.id,
            team_id=tm.team_id,
            user_id=tm.user_id,
            role=tm.role,
            invited_by=tm.invited_by,
            joined_at=tm.joined_at,
            user_email=user.email,
            user_full_name=user.full_name,
        )
        for tm, user in result.all()
    ]


@router.post("/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: UUID,
    data: TeamMemberAdd,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add a member to the team by email"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    if not await check_team_admin_access(db, team, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    # Find user by email in the same organization
    result = await db.execute(
        select(User).where(
            User.email == data.email,
            User.organization_id == current_user.org_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in organization",
        )

    # Check if already a member
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a team member",
        )

    member = TeamMember(
        team_id=team_id,
        user_id=user.id,
        role=data.role,
        invited_by=current_user.user_id,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return TeamMemberResponse(
        id=member.id,
        team_id=member.team_id,
        user_id=member.user_id,
        role=member.role,
        invited_by=member.invited_by,
        joined_at=member.joined_at,
        user_email=user.email,
        user_full_name=user.full_name,
    )


@router.put("/{team_id}/members/{user_id}", response_model=TeamMemberResponse)
async def update_team_member(
    team_id: UUID,
    user_id: UUID,
    data: TeamMemberUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a team member's role"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    if not await check_team_admin_access(db, team, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    member, user = row
    member.role = data.role
    await db.commit()
    await db.refresh(member)

    return TeamMemberResponse(
        id=member.id,
        team_id=member.team_id,
        user_id=member.user_id,
        role=member.role,
        invited_by=member.invited_by,
        joined_at=member.joined_at,
        user_email=user.email,
        user_full_name=user.full_name,
    )


@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: UUID,
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove a member from the team"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    if not await check_team_admin_access(db, team, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    await db.delete(member)
    await db.commit()
    return {"message": "Member removed from team"}


# Team permissions endpoints
@router.get("/{team_id}/permissions", response_model=TeamPermissionsResponse)
async def get_team_permissions(
    team_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get team permissions"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    result = await db.execute(
        select(TeamPermissionGrant).where(TeamPermissionGrant.team_id == team_id)
    )
    permissions = [p.permission for p in result.scalars().all()]

    return TeamPermissionsResponse(team_id=team_id, permissions=permissions)


@router.put("/{team_id}/permissions", response_model=TeamPermissionsResponse)
async def update_team_permissions(
    team_id: UUID,
    data: TeamPermissionsUpdate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Set team permissions (replaces existing)"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    # Delete existing permissions
    await db.execute(
        delete(TeamPermissionGrant).where(TeamPermissionGrant.team_id == team_id)
    )

    # Add new permissions
    for permission in data.permissions:
        grant = TeamPermissionGrant(
            team_id=team_id,
            permission=permission,
            granted_by=current_user.user_id,
        )
        db.add(grant)

    await db.commit()

    return TeamPermissionsResponse(team_id=team_id, permissions=data.permissions)


# Team model access endpoints
@router.get("/{team_id}/models", response_model=List[TeamModelAccessResponse])
async def get_team_model_access(
    team_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get team's accessible models"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    result = await db.execute(
        select(TeamModelAccess, AIModel)
        .join(AIModel, TeamModelAccess.model_id == AIModel.id)
        .where(TeamModelAccess.team_id == team_id)
    )

    return [
        TeamModelAccessResponse(
            id=tma.id,
            team_id=tma.team_id,
            model_id=tma.model_id,
            model_name=model.name,
            model_slug=model.slug,
            granted_at=tma.granted_at,
        )
        for tma, model in result.all()
    ]


@router.put("/{team_id}/models", response_model=List[TeamModelAccessResponse])
async def update_team_model_access(
    team_id: UUID,
    data: TeamModelAccessUpdate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Set team's accessible models (replaces existing)"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    # Verify all models are subscribed by the organization
    if data.model_ids:
        result = await db.execute(
            select(Subscription.model_id).where(
                Subscription.organization_id == current_user.org_id,
                Subscription.model_id.in_(data.model_ids),
                Subscription.status == "active",
            )
        )
        subscribed_ids = set(r[0] for r in result.all())

        for model_id in data.model_ids:
            if model_id not in subscribed_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Model {model_id} is not subscribed by the organization",
                )

    # Delete existing access
    await db.execute(
        delete(TeamModelAccess).where(TeamModelAccess.team_id == team_id)
    )

    # Add new access
    for model_id in data.model_ids:
        access = TeamModelAccess(
            team_id=team_id,
            model_id=model_id,
            granted_by=current_user.user_id,
        )
        db.add(access)

    await db.commit()

    # Return updated list
    result = await db.execute(
        select(TeamModelAccess, AIModel)
        .join(AIModel, TeamModelAccess.model_id == AIModel.id)
        .where(TeamModelAccess.team_id == team_id)
    )

    return [
        TeamModelAccessResponse(
            id=tma.id,
            team_id=tma.team_id,
            model_id=tma.model_id,
            model_name=model.name,
            model_slug=model.slug,
            granted_at=tma.granted_at,
        )
        for tma, model in result.all()
    ]


# Team data source access endpoints
@router.get("/{team_id}/data-sources", response_model=List[TeamDataSourceAccessResponse])
async def get_team_data_source_access(
    team_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get team's accessible data sources"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    result = await db.execute(
        select(TeamDataSourceAccess, DataSource)
        .join(DataSource, TeamDataSourceAccess.data_source_id == DataSource.id)
        .where(TeamDataSourceAccess.team_id == team_id)
    )

    return [
        TeamDataSourceAccessResponse(
            id=tdsa.id,
            team_id=tdsa.team_id,
            data_source_id=tdsa.data_source_id,
            data_source_name=ds.name,
            granted_at=tdsa.granted_at,
        )
        for tdsa, ds in result.all()
    ]


@router.put("/{team_id}/data-sources", response_model=List[TeamDataSourceAccessResponse])
async def update_team_data_source_access(
    team_id: UUID,
    data: TeamDataSourceAccessUpdate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Set team's accessible data sources (replaces existing)"""
    team = await get_team_or_404(db, team_id, current_user.org_id)

    # Verify all data sources belong to the organization
    if data.data_source_ids:
        result = await db.execute(
            select(DataSource.id).where(
                DataSource.organization_id == current_user.org_id,
                DataSource.id.in_(data.data_source_ids),
            )
        )
        org_ds_ids = set(r[0] for r in result.all())

        for ds_id in data.data_source_ids:
            if ds_id not in org_ds_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Data source {ds_id} does not belong to the organization",
                )

    # Delete existing access
    await db.execute(
        delete(TeamDataSourceAccess).where(TeamDataSourceAccess.team_id == team_id)
    )

    # Add new access
    for ds_id in data.data_source_ids:
        access = TeamDataSourceAccess(
            team_id=team_id,
            data_source_id=ds_id,
            granted_by=current_user.user_id,
        )
        db.add(access)

    await db.commit()

    # Return updated list
    result = await db.execute(
        select(TeamDataSourceAccess, DataSource)
        .join(DataSource, TeamDataSourceAccess.data_source_id == DataSource.id)
        .where(TeamDataSourceAccess.team_id == team_id)
    )

    return [
        TeamDataSourceAccessResponse(
            id=tdsa.id,
            team_id=tdsa.team_id,
            data_source_id=tdsa.data_source_id,
            data_source_name=ds.name,
            granted_at=tdsa.granted_at,
        )
        for tdsa, ds in result.all()
    ]
