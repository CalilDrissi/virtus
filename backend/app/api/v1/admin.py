from typing import Annotated, List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.models.ai_model import AIModel
from app.models.subscription import Subscription
from app.models.usage import UsageRecord
from app.schemas.organization import OrganizationResponse, OrganizationWithStats
from app.schemas.user import UserResponse
from app.api.deps import get_current_user, CurrentUser, require_platform_admin


class UserWithOrg(UserResponse):
    """User response with organization name"""
    organization_name: str
    total_usage_tokens: int = 0
    total_cost: float = 0


class CreditAssignment(BaseModel):
    """Schema for assigning credits"""
    amount: Decimal
    reason: Optional[str] = None

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


# ============== Client Management Endpoints ==============

@router.get("/clients", response_model=List[UserWithOrg])
async def list_all_clients(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    active_only: bool = False,
):
    """List all users across all organizations"""
    query = select(User).options(selectinload(User.organization))

    if search:
        query = query.where(
            (User.email.ilike(f"%{search}%")) | (User.full_name.ilike(f"%{search}%"))
        )

    if active_only:
        query = query.where(User.is_active == True)

    query = query.order_by(User.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    results = []
    for user in users:
        # Get usage stats for this user's organization
        usage_result = await db.execute(
            select(
                func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens).label("total_tokens"),
                func.sum(UsageRecord.cost).label("total_cost"),
            ).where(UsageRecord.organization_id == user.organization_id)
        )
        usage = usage_result.one()

        results.append(
            UserWithOrg(
                **UserResponse.model_validate(user).model_dump(),
                organization_name=user.organization.name if user.organization else "Unknown",
                total_usage_tokens=usage.total_tokens or 0,
                total_cost=float(usage.total_cost or 0),
            )
        )

    return results


@router.get("/clients/{user_id}", response_model=UserWithOrg)
async def get_client(
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a specific client's details"""
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.organization))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Get usage stats
    usage_result = await db.execute(
        select(
            func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens).label("total_tokens"),
            func.sum(UsageRecord.cost).label("total_cost"),
        ).where(UsageRecord.organization_id == user.organization_id)
    )
    usage = usage_result.one()

    return UserWithOrg(
        **UserResponse.model_validate(user).model_dump(),
        organization_name=user.organization.name if user.organization else "Unknown",
        total_usage_tokens=usage.total_tokens or 0,
        total_cost=float(usage.total_cost or 0),
    )


@router.patch("/clients/{user_id}/activate")
async def activate_client(
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Activate a client account"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = True
    await db.commit()
    return {"message": "User activated", "is_active": True}


@router.patch("/clients/{user_id}/deactivate")
async def deactivate_client(
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Deactivate a client account"""
    if current_user.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    await db.commit()
    return {"message": "User deactivated", "is_active": False}


@router.post("/organizations/{org_id}/credits")
async def assign_credits(
    org_id: UUID,
    data: CreditAssignment,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Assign credits to an organization"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    org.credit_balance = (org.credit_balance or Decimal("0")) + data.amount
    await db.commit()
    await db.refresh(org)

    return {
        "message": f"Credits assigned successfully",
        "new_balance": float(org.credit_balance),
        "amount_added": float(data.amount),
    }


@router.get("/organizations/{org_id}/credits")
async def get_organization_credits(
    org_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get organization credit balance"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    return {
        "organization_id": str(org.id),
        "organization_name": org.name,
        "credit_balance": float(org.credit_balance or 0),
    }


# ============== Analytics Endpoints ==============

@router.get("/analytics/usage-over-time")
async def get_usage_over_time(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=7, le=90),
):
    """Get daily usage trends for the specified number of days"""
    start_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            cast(UsageRecord.recorded_at, Date).label("date"),
            func.sum(UsageRecord.input_tokens).label("input_tokens"),
            func.sum(UsageRecord.output_tokens).label("output_tokens"),
            func.sum(UsageRecord.request_count).label("requests"),
            func.sum(UsageRecord.cost).label("cost"),
        )
        .where(UsageRecord.recorded_at >= start_date)
        .group_by(cast(UsageRecord.recorded_at, Date))
        .order_by(cast(UsageRecord.recorded_at, Date))
    )
    rows = result.all()

    return [
        {
            "date": row.date.isoformat() if row.date else None,
            "input_tokens": row.input_tokens or 0,
            "output_tokens": row.output_tokens or 0,
            "total_tokens": (row.input_tokens or 0) + (row.output_tokens or 0),
            "requests": row.requests or 0,
            "revenue": float(row.cost or 0),
        }
        for row in rows
    ]


@router.get("/analytics/top-models")
async def get_top_models(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(30, ge=7, le=90),
):
    """Get top models by usage"""
    start_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            UsageRecord.model_id,
            func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens).label("total_tokens"),
            func.sum(UsageRecord.request_count).label("total_requests"),
            func.sum(UsageRecord.cost).label("total_revenue"),
        )
        .where(UsageRecord.recorded_at >= start_date, UsageRecord.model_id.isnot(None))
        .group_by(UsageRecord.model_id)
        .order_by(func.sum(UsageRecord.request_count).desc())
        .limit(limit)
    )
    rows = result.all()

    results = []
    for row in rows:
        # Get model name
        model_result = await db.execute(
            select(AIModel.name, AIModel.provider).where(AIModel.id == row.model_id)
        )
        model = model_result.one_or_none()

        results.append({
            "model_id": str(row.model_id),
            "model_name": model.name if model else "Unknown",
            "provider": model.provider if model else "Unknown",
            "total_tokens": row.total_tokens or 0,
            "total_requests": row.total_requests or 0,
            "total_revenue": float(row.total_revenue or 0),
        })

    return results


@router.get("/analytics/top-organizations")
async def get_top_organizations(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(30, ge=7, le=90),
):
    """Get top organizations by usage"""
    start_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            UsageRecord.organization_id,
            func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens).label("total_tokens"),
            func.sum(UsageRecord.request_count).label("total_requests"),
            func.sum(UsageRecord.cost).label("total_spent"),
        )
        .where(UsageRecord.recorded_at >= start_date)
        .group_by(UsageRecord.organization_id)
        .order_by(func.sum(UsageRecord.cost).desc())
        .limit(limit)
    )
    rows = result.all()

    results = []
    for row in rows:
        # Get org name
        org_result = await db.execute(
            select(Organization.name, Organization.plan).where(Organization.id == row.organization_id)
        )
        org = org_result.one_or_none()

        results.append({
            "organization_id": str(row.organization_id),
            "organization_name": org.name if org else "Unknown",
            "plan": org.plan if org else "Unknown",
            "total_tokens": row.total_tokens or 0,
            "total_requests": row.total_requests or 0,
            "total_spent": float(row.total_spent or 0),
        })

    return results


@router.get("/analytics/signups-over-time")
async def get_signups_over_time(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=7, le=90),
):
    """Get daily signup trends"""
    start_date = datetime.utcnow() - timedelta(days=days)

    # User signups
    user_result = await db.execute(
        select(
            cast(User.created_at, Date).label("date"),
            func.count(User.id).label("count"),
        )
        .where(User.created_at >= start_date)
        .group_by(cast(User.created_at, Date))
        .order_by(cast(User.created_at, Date))
    )
    user_rows = user_result.all()

    # Organization signups
    org_result = await db.execute(
        select(
            cast(Organization.created_at, Date).label("date"),
            func.count(Organization.id).label("count"),
        )
        .where(Organization.created_at >= start_date)
        .group_by(cast(Organization.created_at, Date))
        .order_by(cast(Organization.created_at, Date))
    )
    org_rows = org_result.all()

    # Combine into a dict by date
    data = {}
    for row in user_rows:
        date_str = row.date.isoformat() if row.date else None
        if date_str:
            data[date_str] = {"date": date_str, "users": row.count or 0, "organizations": 0}

    for row in org_rows:
        date_str = row.date.isoformat() if row.date else None
        if date_str:
            if date_str in data:
                data[date_str]["organizations"] = row.count or 0
            else:
                data[date_str] = {"date": date_str, "users": 0, "organizations": row.count or 0}

    return sorted(data.values(), key=lambda x: x["date"])


@router.get("/analytics/subscriptions-over-time")
async def get_subscriptions_over_time(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=7, le=90),
):
    """Get subscription trends"""
    start_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            cast(Subscription.created_at, Date).label("date"),
            func.count(Subscription.id).label("count"),
        )
        .where(Subscription.created_at >= start_date)
        .group_by(cast(Subscription.created_at, Date))
        .order_by(cast(Subscription.created_at, Date))
    )
    rows = result.all()

    return [
        {
            "date": row.date.isoformat() if row.date else None,
            "subscriptions": row.count or 0,
        }
        for row in rows
    ]


@router.get("/analytics/revenue-by-model")
async def get_revenue_by_model(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=7, le=90),
):
    """Get revenue breakdown by model"""
    start_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            UsageRecord.model_id,
            func.sum(UsageRecord.cost).label("revenue"),
        )
        .where(UsageRecord.recorded_at >= start_date, UsageRecord.model_id.isnot(None))
        .group_by(UsageRecord.model_id)
        .order_by(func.sum(UsageRecord.cost).desc())
    )
    rows = result.all()

    results = []
    for row in rows:
        model_result = await db.execute(
            select(AIModel.name).where(AIModel.id == row.model_id)
        )
        model = model_result.scalar_one_or_none()

        results.append({
            "model_id": str(row.model_id),
            "model_name": model or "Unknown",
            "revenue": float(row.revenue or 0),
        })

    return results


@router.get("/analytics/summary")
async def get_analytics_summary(
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get analytics summary with comparisons"""
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    this_week = today - timedelta(days=today.weekday())
    this_month = today.replace(day=1)
    last_month = (this_month - timedelta(days=1)).replace(day=1)

    # This month's usage
    this_month_result = await db.execute(
        select(
            func.sum(UsageRecord.request_count).label("requests"),
            func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens).label("tokens"),
            func.sum(UsageRecord.cost).label("revenue"),
        ).where(UsageRecord.recorded_at >= this_month)
    )
    this_month_data = this_month_result.one()

    # Last month's usage
    last_month_result = await db.execute(
        select(
            func.sum(UsageRecord.request_count).label("requests"),
            func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens).label("tokens"),
            func.sum(UsageRecord.cost).label("revenue"),
        ).where(
            UsageRecord.recorded_at >= last_month,
            UsageRecord.recorded_at < this_month,
        )
    )
    last_month_data = last_month_result.one()

    # New users this month vs last month
    this_month_users = await db.execute(
        select(func.count(User.id)).where(User.created_at >= this_month)
    )
    last_month_users = await db.execute(
        select(func.count(User.id)).where(
            User.created_at >= last_month,
            User.created_at < this_month,
        )
    )

    # New subscriptions this month vs last month
    this_month_subs = await db.execute(
        select(func.count(Subscription.id)).where(Subscription.created_at >= this_month)
    )
    last_month_subs = await db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.created_at >= last_month,
            Subscription.created_at < this_month,
        )
    )

    def calc_change(current, previous):
        if not previous or previous == 0:
            return 100 if current else 0
        return round(((current - previous) / previous) * 100, 1)

    this_requests = this_month_data.requests or 0
    last_requests = last_month_data.requests or 0
    this_tokens = this_month_data.tokens or 0
    last_tokens = last_month_data.tokens or 0
    this_revenue = float(this_month_data.revenue or 0)
    last_revenue = float(last_month_data.revenue or 0)
    this_users_count = this_month_users.scalar() or 0
    last_users_count = last_month_users.scalar() or 0
    this_subs_count = this_month_subs.scalar() or 0
    last_subs_count = last_month_subs.scalar() or 0

    return {
        "this_month": {
            "requests": this_requests,
            "tokens": this_tokens,
            "revenue": this_revenue,
            "new_users": this_users_count,
            "new_subscriptions": this_subs_count,
        },
        "last_month": {
            "requests": last_requests,
            "tokens": last_tokens,
            "revenue": last_revenue,
            "new_users": last_users_count,
            "new_subscriptions": last_subs_count,
        },
        "changes": {
            "requests": calc_change(this_requests, last_requests),
            "tokens": calc_change(this_tokens, last_tokens),
            "revenue": calc_change(this_revenue, last_revenue),
            "new_users": calc_change(this_users_count, last_users_count),
            "new_subscriptions": calc_change(this_subs_count, last_subs_count),
        },
    }
