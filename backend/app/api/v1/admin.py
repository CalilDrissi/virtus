from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.models.ai_model import AIModel
from app.models.subscription import Subscription
from app.models.usage import UsageRecord
from app.schemas.organization import OrganizationResponse, OrganizationWithStats
from app.api.deps import get_current_user, CurrentUser, require_platform_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


class PlatformStats(dict):
    pass


@router.get("/stats", response_model=dict)
async def get_platform_stats(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get platform-wide statistics"""
    # Organization count
    result = await db.execute(select(func.count(Organization.id)))
    org_count = result.scalar() or 0

    # User count
    result = await db.execute(select(func.count(User.id)))
    user_count = result.scalar() or 0

    # Model count
    result = await db.execute(select(func.count(AIModel.id)).where(AIModel.is_active == True))
    model_count = result.scalar() or 0

    # Active subscription count
    result = await db.execute(
        select(func.count(Subscription.id)).where(Subscription.status == "active")
    )
    subscription_count = result.scalar() or 0

    # Total usage
    result = await db.execute(
        select(
            func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens).label("total_tokens"),
            func.sum(UsageRecord.request_count).label("total_requests"),
            func.sum(UsageRecord.cost).label("total_revenue"),
        )
    )
    usage = result.one()

    return {
        "organizations": org_count,
        "users": user_count,
        "models": model_count,
        "active_subscriptions": subscription_count,
        "total_tokens": usage.total_tokens or 0,
        "total_requests": usage.total_requests or 0,
        "total_revenue": float(usage.total_revenue or 0),
    }


@router.get("/organizations", response_model=List[OrganizationWithStats])
async def list_organizations(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
):
    """List all organizations with stats"""
    result = await db.execute(
        select(Organization)
        .order_by(Organization.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    organizations = result.scalars().all()

    results = []
    for org in organizations:
        # Get stats
        user_result = await db.execute(
            select(func.count(User.id)).where(User.organization_id == org.id)
        )
        user_count = user_result.scalar() or 0

        sub_result = await db.execute(
            select(func.count(Subscription.id)).where(
                Subscription.organization_id == org.id,
                Subscription.status == "active",
            )
        )
        sub_count = sub_result.scalar() or 0

        usage_result = await db.execute(
            select(func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens)).where(
                UsageRecord.organization_id == org.id
            )
        )
        total_usage = usage_result.scalar() or 0

        results.append(
            OrganizationWithStats(
                **OrganizationResponse.model_validate(org).model_dump(),
                user_count=user_count,
                subscription_count=sub_count,
                total_usage_tokens=total_usage,
            )
        )

    return results


@router.get("/organizations/{org_id}", response_model=OrganizationWithStats)
async def get_organization(
    org_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get organization details"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Get stats
    user_result = await db.execute(
        select(func.count(User.id)).where(User.organization_id == org.id)
    )
    user_count = user_result.scalar() or 0

    sub_result = await db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.organization_id == org.id,
            Subscription.status == "active",
        )
    )
    sub_count = sub_result.scalar() or 0

    usage_result = await db.execute(
        select(func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens)).where(
            UsageRecord.organization_id == org.id
        )
    )
    total_usage = usage_result.scalar() or 0

    return OrganizationWithStats(
        **OrganizationResponse.model_validate(org).model_dump(),
        user_count=user_count,
        subscription_count=sub_count,
        total_usage_tokens=total_usage,
    )


@router.patch("/organizations/{org_id}/plan")
async def update_organization_plan(
    org_id: UUID,
    plan: str,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update organization plan"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    org.plan = plan
    await db.commit()
    return {"message": "Plan updated"}


@router.post("/users/{user_id}/make-admin")
async def make_platform_admin(
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Make a user a platform admin"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_platform_admin = True
    await db.commit()
    return {"message": "User is now a platform admin"}


@router.post("/users/{user_id}/remove-admin")
async def remove_platform_admin(
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove platform admin status from a user"""
    if current_user.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove admin status from yourself",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_platform_admin = False
    await db.commit()
    return {"message": "User is no longer a platform admin"}
