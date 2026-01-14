from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database import get_db
from app.models.user import User
from app.models.role import Role, RolePermission, RoleModelAccess, RoleDataSourceAccess
from app.models.ai_model import AIModel
from app.models.data_source import DataSource
from app.models.subscription import Subscription
from app.models.team import TeamPermission
from app.schemas.role import (
    RoleCreate, RoleUpdate, RoleResponse, RoleListResponse,
    RoleModelAccessResponse, RoleDataSourceAccessResponse,
    UserRoleAssign,
)
from app.api.deps import get_current_user, CurrentUser, require_org_admin

router = APIRouter(prefix="/roles", tags=["Roles"])


async def build_role_response(db: AsyncSession, role: Role) -> RoleResponse:
    """Build full role response with all access info"""
    # Get permissions
    perm_result = await db.execute(
        select(RolePermission.permission).where(RolePermission.role_id == role.id)
    )
    permissions = [p[0] for p in perm_result.all()]

    # Get model access
    model_result = await db.execute(
        select(RoleModelAccess, AIModel)
        .join(AIModel, RoleModelAccess.model_id == AIModel.id)
        .where(RoleModelAccess.role_id == role.id)
    )
    model_access = [
        RoleModelAccessResponse(
            model_id=rma.model_id,
            model_name=model.name,
            model_slug=model.slug,
        )
        for rma, model in model_result.all()
    ]

    # Get data source access
    ds_result = await db.execute(
        select(RoleDataSourceAccess, DataSource)
        .join(DataSource, RoleDataSourceAccess.data_source_id == DataSource.id)
        .where(RoleDataSourceAccess.role_id == role.id)
    )
    data_source_access = [
        RoleDataSourceAccessResponse(
            data_source_id=rdsa.data_source_id,
            data_source_name=ds.name,
        )
        for rdsa, ds in ds_result.all()
    ]

    # Get user count
    count_result = await db.execute(
        select(func.count(User.id)).where(User.custom_role_id == role.id)
    )
    user_count = count_result.scalar() or 0

    return RoleResponse(
        id=role.id,
        organization_id=role.organization_id,
        name=role.name,
        description=role.description,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permissions=permissions,
        model_access=model_access,
        data_source_access=data_source_access,
        user_count=user_count,
    )


@router.get("", response_model=List[RoleListResponse])
async def list_roles(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all roles in the organization"""
    result = await db.execute(
        select(Role)
        .where(Role.organization_id == current_user.org_id)
        .order_by(Role.name)
    )
    roles = result.scalars().all()

    responses = []
    for role in roles:
        # Get permissions
        perm_result = await db.execute(
            select(RolePermission.permission).where(RolePermission.role_id == role.id)
        )
        permissions = [p[0] for p in perm_result.all()]

        # Get user count
        count_result = await db.execute(
            select(func.count(User.id)).where(User.custom_role_id == role.id)
        )
        user_count = count_result.scalar() or 0

        responses.append(RoleListResponse(
            id=role.id,
            organization_id=role.organization_id,
            name=role.name,
            description=role.description,
            created_at=role.created_at,
            permissions=permissions,
            user_count=user_count,
        ))

    return responses


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new role"""
    # Create role
    role = Role(
        organization_id=current_user.org_id,
        name=data.name,
        description=data.description,
    )
    db.add(role)
    await db.flush()

    # Add permissions
    for permission in data.permissions:
        db.add(RolePermission(role_id=role.id, permission=permission))

    # Add model access (verify subscriptions)
    if data.model_ids:
        sub_result = await db.execute(
            select(Subscription.model_id).where(
                Subscription.organization_id == current_user.org_id,
                Subscription.model_id.in_(data.model_ids),
                Subscription.status == "active",
            )
        )
        subscribed_ids = set(r[0] for r in sub_result.all())
        for model_id in data.model_ids:
            if model_id in subscribed_ids:
                db.add(RoleModelAccess(role_id=role.id, model_id=model_id))

    # Add data source access (verify ownership)
    if data.data_source_ids:
        ds_result = await db.execute(
            select(DataSource.id).where(
                DataSource.organization_id == current_user.org_id,
                DataSource.id.in_(data.data_source_ids),
            )
        )
        org_ds_ids = set(r[0] for r in ds_result.all())
        for ds_id in data.data_source_ids:
            if ds_id in org_ds_ids:
                db.add(RoleDataSourceAccess(role_id=role.id, data_source_id=ds_id))

    await db.commit()
    await db.refresh(role)

    return await build_role_response(db, role)


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get role details"""
    result = await db.execute(
        select(Role).where(
            Role.id == role_id,
            Role.organization_id == current_user.org_id,
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    return await build_role_response(db, role)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    data: RoleUpdate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a role"""
    result = await db.execute(
        select(Role).where(
            Role.id == role_id,
            Role.organization_id == current_user.org_id,
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    # Update basic fields
    if data.name is not None:
        role.name = data.name
    if data.description is not None:
        role.description = data.description

    # Update permissions if provided
    if data.permissions is not None:
        await db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
        for permission in data.permissions:
            db.add(RolePermission(role_id=role_id, permission=permission))

    # Update model access if provided
    if data.model_ids is not None:
        await db.execute(delete(RoleModelAccess).where(RoleModelAccess.role_id == role_id))
        if data.model_ids:
            sub_result = await db.execute(
                select(Subscription.model_id).where(
                    Subscription.organization_id == current_user.org_id,
                    Subscription.model_id.in_(data.model_ids),
                    Subscription.status == "active",
                )
            )
            subscribed_ids = set(r[0] for r in sub_result.all())
            for model_id in data.model_ids:
                if model_id in subscribed_ids:
                    db.add(RoleModelAccess(role_id=role_id, model_id=model_id))

    # Update data source access if provided
    if data.data_source_ids is not None:
        await db.execute(delete(RoleDataSourceAccess).where(RoleDataSourceAccess.role_id == role_id))
        if data.data_source_ids:
            ds_result = await db.execute(
                select(DataSource.id).where(
                    DataSource.organization_id == current_user.org_id,
                    DataSource.id.in_(data.data_source_ids),
                )
            )
            org_ds_ids = set(r[0] for r in ds_result.all())
            for ds_id in data.data_source_ids:
                if ds_id in org_ds_ids:
                    db.add(RoleDataSourceAccess(role_id=role_id, data_source_id=ds_id))

    await db.commit()
    await db.refresh(role)

    return await build_role_response(db, role)


@router.delete("/{role_id}")
async def delete_role(
    role_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a role"""
    result = await db.execute(
        select(Role).where(
            Role.id == role_id,
            Role.organization_id == current_user.org_id,
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    await db.delete(role)
    await db.commit()
    return {"message": "Role deleted"}


@router.put("/users/{user_id}/role")
async def assign_user_role(
    user_id: UUID,
    data: UserRoleAssign,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Assign or remove a role from a user"""
    # Get user
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == current_user.org_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Verify role belongs to org if provided
    if data.role_id:
        role_result = await db.execute(
            select(Role).where(
                Role.id == data.role_id,
                Role.organization_id == current_user.org_id,
            )
        )
        if not role_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    user.custom_role_id = data.role_id
    await db.commit()

    return {"message": "Role assigned" if data.role_id else "Role removed"}


@router.get("/users/{user_id}/role", response_model=RoleResponse | None)
async def get_user_role(
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a user's assigned role"""
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == current_user.org_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.custom_role_id:
        return None

    role_result = await db.execute(select(Role).where(Role.id == user.custom_role_id))
    role = role_result.scalar_one_or_none()
    if not role:
        return None

    return await build_role_response(db, role)
