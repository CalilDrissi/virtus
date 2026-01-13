from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.models.subscription import Subscription
from app.models.usage import UsageRecord
from app.schemas.organization import OrganizationUpdate, OrganizationResponse, OrganizationWithStats
from app.api.deps import get_current_user, CurrentUser, require_org_admin
from app.utils.security import generate_slug

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("/current", response_model=OrganizationResponse)
async def get_current_organization(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Get the current organization"""
    return OrganizationResponse.model_validate(current_user.organization)


@router.get("/current/stats", response_model=OrganizationWithStats)
async def get_organization_stats(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get organization with stats"""
    org = current_user.organization

    # Get user count
    result = await db.execute(
        select(func.count(User.id)).where(User.organization_id == org.id)
    )
    user_count = result.scalar() or 0

    # Get subscription count
    result = await db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.organization_id == org.id,
            Subscription.status == "active",
        )
    )
    subscription_count = result.scalar() or 0

    # Get total usage tokens
    result = await db.execute(
        select(
            func.coalesce(func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens), 0)
        ).where(UsageRecord.organization_id == org.id)
    )
    total_usage_tokens = result.scalar() or 0

    return OrganizationWithStats(
        **OrganizationResponse.model_validate(org).model_dump(),
        user_count=user_count,
        subscription_count=subscription_count,
        total_usage_tokens=total_usage_tokens,
    )


@router.patch("/current", response_model=OrganizationResponse)
async def update_organization(
    data: OrganizationUpdate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update the current organization"""
    org = current_user.organization

    update_data = data.model_dump(exclude_unset=True)

    # Handle slug update
    if "slug" in update_data:
        new_slug = generate_slug(update_data["slug"])
        result = await db.execute(
            select(Organization).where(
                Organization.slug == new_slug,
                Organization.id != org.id,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slug already taken",
            )
        update_data["slug"] = new_slug

    # Prevent non-platform-admins from changing plan
    if "plan" in update_data and not current_user.is_platform_admin:
        del update_data["plan"]

    for field, value in update_data.items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)
    return OrganizationResponse.model_validate(org)
