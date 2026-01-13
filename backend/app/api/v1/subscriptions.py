from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.subscription import Subscription, SubscriptionStatus
from app.schemas.subscription import SubscriptionCreate, SubscriptionResponse, SubscriptionWithUsage
from app.schemas.billing import CheckoutSessionRequest, CheckoutSessionResponse
from app.services.billing import BillingService
from app.services.usage_tracker import UsageTracker
from app.api.deps import get_current_user, CurrentUser, require_org_admin

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("", response_model=List[SubscriptionResponse])
async def list_subscriptions(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all subscriptions for the organization"""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.organization_id == current_user.org_id)
        .options(selectinload(Subscription.model))
        .order_by(Subscription.created_at.desc())
    )
    subscriptions = result.scalars().all()
    return [SubscriptionResponse.model_validate(s) for s in subscriptions]


@router.get("/active", response_model=List[SubscriptionWithUsage])
async def list_active_subscriptions(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List active subscriptions with usage data"""
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.organization_id == current_user.org_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
        )
        .options(selectinload(Subscription.model))
    )
    subscriptions = result.scalars().all()

    usage_tracker = UsageTracker(db)
    results = []

    for sub in subscriptions:
        usage = await usage_tracker.get_subscription_usage(sub.id)
        results.append(
            SubscriptionWithUsage(
                **SubscriptionResponse.model_validate(sub).model_dump(),
                usage_this_period=usage["total_tokens"] if usage else 0,
                cost_this_period=usage["total_cost"] if usage else 0,
            )
        )

    return results


@router.get("/{subscription_id}", response_model=SubscriptionWithUsage)
async def get_subscription(
    subscription_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a specific subscription with usage"""
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.id == subscription_id,
            Subscription.organization_id == current_user.org_id,
        )
        .options(selectinload(Subscription.model))
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    usage_tracker = UsageTracker(db)
    usage = await usage_tracker.get_subscription_usage(subscription_id)

    return SubscriptionWithUsage(
        **SubscriptionResponse.model_validate(subscription).model_dump(),
        usage_this_period=usage["total_tokens"] if usage else 0,
        cost_this_period=usage["total_cost"] if usage else 0,
    )


@router.post("/checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    data: CheckoutSessionRequest,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a Stripe checkout session to subscribe to a model"""
    billing = BillingService(db)
    try:
        result = await billing.create_checkout_session(
            current_user.organization,
            data.model_id,
            data.success_url,
            data.cancel_url,
        )
        return CheckoutSessionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cancel a subscription"""
    billing = BillingService(db)
    success = await billing.cancel_subscription(subscription_id, current_user.org_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return {"message": "Subscription cancelled"}


@router.get("/{subscription_id}/usage-limits")
async def check_usage_limits(
    subscription_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Check if subscription is within usage limits"""
    # Verify ownership
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.organization_id == current_user.org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    usage_tracker = UsageTracker(db)
    return await usage_tracker.check_usage_limits(subscription_id)
