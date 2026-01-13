from typing import Annotated, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
import stripe
from app.database import get_db
from app.services.billing import BillingService
from app.services.usage_tracker import UsageTracker
from app.schemas.billing import UsageSummary, BillingPortalResponse
from app.api.deps import get_current_user, CurrentUser
from app.config import settings

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/usage", response_model=UsageSummary)
async def get_usage_summary(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    period_start: datetime = None,
    period_end: datetime = None,
):
    """Get usage summary for the current billing period"""
    usage_tracker = UsageTracker(db)
    summary = await usage_tracker.get_usage_summary(
        current_user.org_id,
        period_start=period_start,
        period_end=period_end,
    )
    return UsageSummary(**summary)


@router.get("/invoices")
async def get_invoices(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get invoices for the organization"""
    billing = BillingService(db)
    return await billing.get_invoices(current_user.organization)


@router.post("/portal", response_model=BillingPortalResponse)
async def get_billing_portal(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    return_url: str = None,
):
    """Get Stripe billing portal URL"""
    if not return_url:
        return_url = "http://localhost:3000/settings/billing"

    billing = BillingService(db)
    url = await billing.get_billing_portal_url(current_user.organization, return_url)
    return BillingPortalResponse(url=url)


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
):
    """Handle Stripe webhooks"""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Webhook secret not configured")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload,
            stripe_signature,
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    billing = BillingService(db)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await billing.handle_checkout_completed(session)

    elif event["type"] in [
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ]:
        subscription = event["data"]["object"]
        await billing.handle_subscription_updated(subscription)

    return {"received": True}
