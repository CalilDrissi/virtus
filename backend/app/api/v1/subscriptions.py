from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.subscription import Subscription, SubscriptionStatus
from app.schemas.subscription import SubscriptionCreate, SubscriptionResponse, SubscriptionWithUsage, SubscriptionDataSourcesUpdate
from app.schemas.ai_model import DataSourceInfo
from app.schemas.billing import CheckoutSessionRequest, CheckoutSessionResponse
from app.schemas.user import APIKeyCreate, APIKeyResponse, APIKeyWithSecret
from app.services.billing import BillingService
from app.services.usage_tracker import UsageTracker
from app.services.auth import AuthService
from app.models.data_source import DataSource
from app.api.deps import get_current_user, CurrentUser, require_org_admin

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("", response_model=List[SubscriptionResponse])
async def list_subscriptions(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all subscriptions for the organization"""
    from app.models.ai_model import AIModel

    result = await db.execute(
        select(Subscription)
        .where(Subscription.organization_id == current_user.org_id)
        .options(
            selectinload(Subscription.model).selectinload(AIModel.pricing),
            selectinload(Subscription.model).selectinload(AIModel.data_sources),
            selectinload(Subscription.data_sources),
        )
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
    from app.models.ai_model import AIModel

    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.organization_id == current_user.org_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
        )
        .options(
            selectinload(Subscription.model).selectinload(AIModel.pricing),
            selectinload(Subscription.model).selectinload(AIModel.data_sources),
            selectinload(Subscription.data_sources),
        )
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
    from app.models.ai_model import AIModel

    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.id == subscription_id,
            Subscription.organization_id == current_user.org_id,
        )
        .options(
            selectinload(Subscription.model).selectinload(AIModel.pricing),
            selectinload(Subscription.model).selectinload(AIModel.data_sources),
            selectinload(Subscription.data_sources),
        )
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
    """Create a Stripe checkout session to subscribe to a model, or create free subscription"""
    import logging
    logger = logging.getLogger(__name__)

    try:
        from app.models.ai_model import AIModel
        from app.config import settings

        # Check if model exists and get pricing
        result = await db.execute(
            select(AIModel)
            .where(AIModel.id == data.model_id, AIModel.is_active == True)
            .options(selectinload(AIModel.pricing))
        )
        model = result.scalar_one_or_none()
        if not model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

        # Check if user already has an active subscription to this model
        existing_sub = await db.execute(
            select(Subscription).where(
                Subscription.organization_id == current_user.org_id,
                Subscription.model_id == data.model_id,
                Subscription.status == SubscriptionStatus.ACTIVE,
            )
        )
        if existing_sub.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already subscribed to this model")

        # Determine if this is a free model or Stripe is not configured
        is_free_model = (
            not model.pricing or
            (float(model.pricing.monthly_subscription_price) == 0 and
             float(model.pricing.price_per_1k_input_tokens) == 0 and
             float(model.pricing.price_per_1k_output_tokens) == 0)
        )
        # Check if Stripe is properly configured (key exists and is not a placeholder)
        stripe_key = settings.STRIPE_SECRET_KEY
        stripe_configured = (
            stripe_key and
            stripe_key.startswith("sk_") and
            "your-" not in stripe_key.lower() and
            len(stripe_key) > 20
        )

        logger.info(f"Checkout: is_free_model={is_free_model}, stripe_configured={stripe_configured}")

        # Create free subscription directly if model is free or Stripe not configured
        if is_free_model or not stripe_configured:
            from datetime import datetime, timedelta

            subscription = Subscription(
                organization_id=current_user.org_id,
                model_id=data.model_id,
                status=SubscriptionStatus.ACTIVE,
                current_period_start=datetime.utcnow(),
                current_period_end=datetime.utcnow() + timedelta(days=365),  # 1 year for free
            )
            db.add(subscription)
            await db.commit()

            # Return success URL directly since no payment needed
            return CheckoutSessionResponse(session_id="free", url=data.success_url)

        # Use Stripe for paid subscriptions
        billing = BillingService(db)
        result = await billing.create_checkout_session(
            current_user.organization,
            data.model_id,
            data.success_url,
            data.cancel_url,
        )
        return CheckoutSessionResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Checkout error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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


@router.get("/{subscription_id}/data-sources", response_model=List[DataSourceInfo])
async def get_subscription_data_sources(
    subscription_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get data sources linked to a subscription"""
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.id == subscription_id,
            Subscription.organization_id == current_user.org_id,
        )
        .options(selectinload(Subscription.data_sources))
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return [DataSourceInfo.model_validate(ds) for ds in subscription.data_sources]


@router.put("/{subscription_id}/data-sources", response_model=List[DataSourceInfo])
async def update_subscription_data_sources(
    subscription_id: UUID,
    data: SubscriptionDataSourcesUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update data sources linked to a subscription (user can add their own data sources)"""
    # Get the subscription
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.id == subscription_id,
            Subscription.organization_id == current_user.org_id,
        )
        .options(selectinload(Subscription.data_sources))
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    # Get the data sources - only allow user's own org data sources
    if data.data_source_ids:
        ds_result = await db.execute(
            select(DataSource).where(
                DataSource.id.in_(data.data_source_ids),
                DataSource.organization_id == current_user.org_id,
            )
        )
        data_sources = list(ds_result.scalars().all())
    else:
        data_sources = []

    # Update the relationship
    subscription.data_sources = data_sources
    await db.commit()

    # Refresh to get updated data
    result = await db.execute(
        select(Subscription)
        .where(Subscription.id == subscription_id)
        .options(selectinload(Subscription.data_sources))
    )
    subscription = result.scalar_one_or_none()

    return [DataSourceInfo.model_validate(ds) for ds in subscription.data_sources]


# API Keys endpoints for subscriptions
@router.get("/{subscription_id}/api-keys", response_model=List[APIKeyResponse])
async def list_subscription_api_keys(
    subscription_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List API keys for a specific subscription"""
    # Verify subscription ownership
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.organization_id == current_user.org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    auth_service = AuthService(db)
    keys = await auth_service.list_api_keys(current_user.org_id, subscription_id)
    return [APIKeyResponse.model_validate(k) for k in keys]


@router.post("/{subscription_id}/api-keys", response_model=APIKeyWithSecret)
async def create_subscription_api_key(
    subscription_id: UUID,
    data: APIKeyCreate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create an API key for a specific subscription"""
    # Verify subscription ownership
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.organization_id == current_user.org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    auth_service = AuthService(db)
    return await auth_service.create_api_key(current_user.org_id, data, subscription_id)


@router.delete("/{subscription_id}/api-keys/{key_id}")
async def revoke_subscription_api_key(
    subscription_id: UUID,
    key_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Revoke an API key for a subscription"""
    # Verify subscription ownership
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.organization_id == current_user.org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    auth_service = AuthService(db)
    success = await auth_service.revoke_api_key(key_id, current_user.org_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    return {"message": "API key revoked"}
