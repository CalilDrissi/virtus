from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
import stripe
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.organization import Organization
from app.models.ai_model import AIModel, ModelPricing, PricingType
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.usage import UsageRecord
from app.config import settings


class BillingService:
    """Service for Stripe billing integration"""

    def __init__(self, db: AsyncSession):
        self.db = db
        stripe.api_key = settings.STRIPE_SECRET_KEY

    async def ensure_stripe_customer(self, organization: Organization) -> str:
        """Ensure organization has a Stripe customer ID"""
        if organization.stripe_customer_id:
            return organization.stripe_customer_id

        customer = stripe.Customer.create(
            name=organization.name,
            metadata={"organization_id": str(organization.id)},
        )

        organization.stripe_customer_id = customer.id
        await self.db.commit()

        return customer.id

    async def create_checkout_session(
        self,
        organization: Organization,
        model_id: UUID,
        success_url: str,
        cancel_url: str,
    ) -> dict:
        """Create a Stripe checkout session for model subscription"""
        # Get model and pricing
        result = await self.db.execute(
            select(AIModel)
            .where(AIModel.id == model_id, AIModel.is_active == True)
            .options(selectinload(AIModel.pricing))
        )
        model = result.scalar_one_or_none()
        if not model or not model.pricing:
            raise ValueError("Model or pricing not found")

        customer_id = await self.ensure_stripe_customer(organization)

        # Create or get Stripe product/price
        pricing = model.pricing
        if not pricing.stripe_product_id:
            await self._create_stripe_product(model, pricing)

        line_items = []

        # Add base subscription if applicable
        if pricing.pricing_type in [PricingType.SUBSCRIPTION, PricingType.HYBRID]:
            if pricing.stripe_price_id:
                line_items.append({
                    "price": pricing.stripe_price_id,
                    "quantity": 1,
                })

        # For pure token/request pricing, create a metered subscription
        if pricing.pricing_type in [PricingType.PER_TOKEN, PricingType.PER_REQUEST, PricingType.HYBRID]:
            if pricing.stripe_metered_price_id:
                line_items.append({
                    "price": pricing.stripe_metered_price_id,
                })

        if not line_items:
            raise ValueError("No pricing configured for this model")

        session = stripe.checkout.Session.create(
            customer=customer_id,
            line_items=line_items,
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "organization_id": str(organization.id),
                "model_id": str(model_id),
            },
        )

        return {"session_id": session.id, "url": session.url}

    async def _create_stripe_product(
        self, model: AIModel, pricing: ModelPricing
    ) -> None:
        """Create Stripe product and prices for a model"""
        # Create product
        product = stripe.Product.create(
            name=model.name,
            description=model.description or f"AI Model: {model.name}",
            metadata={"model_id": str(model.id)},
        )
        pricing.stripe_product_id = product.id

        # Create base price for subscription
        if pricing.pricing_type in [PricingType.SUBSCRIPTION, PricingType.HYBRID]:
            if pricing.monthly_subscription_price > 0:
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=int(pricing.monthly_subscription_price * 100),
                    currency="usd",
                    recurring={"interval": "month"},
                )
                pricing.stripe_price_id = price.id

        # Create metered price for usage-based billing
        if pricing.pricing_type in [PricingType.PER_TOKEN, PricingType.PER_REQUEST, PricingType.HYBRID]:
            # Use per-token pricing (in USD per 1000 tokens)
            unit_amount = int(
                (pricing.price_per_1k_input_tokens + pricing.price_per_1k_output_tokens)
                / 2
                * 100
            )  # Average, convert to cents
            if unit_amount > 0:
                metered_price = stripe.Price.create(
                    product=product.id,
                    unit_amount=max(unit_amount, 1),  # Minimum 1 cent
                    currency="usd",
                    recurring={
                        "interval": "month",
                        "usage_type": "metered",
                    },
                )
                pricing.stripe_metered_price_id = metered_price.id

        await self.db.commit()

    async def handle_checkout_completed(self, session: dict) -> Subscription:
        """Handle successful checkout - create subscription record"""
        organization_id = UUID(session["metadata"]["organization_id"])
        model_id = UUID(session["metadata"]["model_id"])
        stripe_subscription_id = session["subscription"]

        # Get subscription details from Stripe
        stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)

        subscription = Subscription(
            organization_id=organization_id,
            model_id=model_id,
            stripe_subscription_id=stripe_subscription_id,
            stripe_subscription_item_id=(
                stripe_sub["items"]["data"][0]["id"]
                if stripe_sub["items"]["data"]
                else None
            ),
            status=SubscriptionStatus.ACTIVE,
            current_period_start=datetime.fromtimestamp(
                stripe_sub["current_period_start"]
            ),
            current_period_end=datetime.fromtimestamp(stripe_sub["current_period_end"]),
        )

        self.db.add(subscription)
        await self.db.commit()
        await self.db.refresh(subscription)

        return subscription

    async def handle_subscription_updated(self, stripe_sub: dict) -> None:
        """Handle subscription update from webhook"""
        result = await self.db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub["id"]
            )
        )
        subscription = result.scalar_one_or_none()
        if not subscription:
            return

        # Map Stripe status to our status
        status_map = {
            "active": SubscriptionStatus.ACTIVE,
            "past_due": SubscriptionStatus.PAST_DUE,
            "canceled": SubscriptionStatus.CANCELLED,
            "trialing": SubscriptionStatus.TRIALING,
            "paused": SubscriptionStatus.PAUSED,
        }

        subscription.status = status_map.get(
            stripe_sub["status"], SubscriptionStatus.ACTIVE
        )
        subscription.current_period_start = datetime.fromtimestamp(
            stripe_sub["current_period_start"]
        )
        subscription.current_period_end = datetime.fromtimestamp(
            stripe_sub["current_period_end"]
        )

        if stripe_sub["status"] == "canceled":
            subscription.cancelled_at = datetime.utcnow()

        await self.db.commit()

    async def cancel_subscription(
        self, subscription_id: UUID, organization_id: UUID
    ) -> bool:
        """Cancel a subscription"""
        result = await self.db.execute(
            select(Subscription).where(
                Subscription.id == subscription_id,
                Subscription.organization_id == organization_id,
            )
        )
        subscription = result.scalar_one_or_none()
        if not subscription:
            return False

        if subscription.stripe_subscription_id:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                cancel_at_period_end=True,
            )

        subscription.status = SubscriptionStatus.CANCELLED
        subscription.cancelled_at = datetime.utcnow()
        await self.db.commit()

        return True

    async def report_usage(
        self,
        subscription: Subscription,
        input_tokens: int,
        output_tokens: int,
    ) -> None:
        """Report usage to Stripe for metered billing"""
        if not subscription.stripe_subscription_item_id:
            return

        # Report token usage (combined input + output)
        total_tokens = input_tokens + output_tokens
        usage_quantity = total_tokens // 1000  # Per 1000 tokens

        if usage_quantity > 0:
            stripe.SubscriptionItem.create_usage_record(
                subscription.stripe_subscription_item_id,
                quantity=usage_quantity,
                timestamp=int(datetime.utcnow().timestamp()),
            )

    async def get_billing_portal_url(
        self, organization: Organization, return_url: str
    ) -> str:
        """Get Stripe billing portal URL"""
        customer_id = await self.ensure_stripe_customer(organization)

        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )

        return session.url

    async def get_invoices(self, organization: Organization) -> List[dict]:
        """Get invoices for an organization"""
        if not organization.stripe_customer_id:
            return []

        invoices = stripe.Invoice.list(
            customer=organization.stripe_customer_id,
            limit=20,
        )

        return [
            {
                "id": inv.id,
                "amount_due": inv.amount_due,
                "amount_paid": inv.amount_paid,
                "currency": inv.currency,
                "status": inv.status,
                "period_start": datetime.fromtimestamp(inv.period_start),
                "period_end": datetime.fromtimestamp(inv.period_end),
                "pdf_url": inv.invoice_pdf,
                "created_at": datetime.fromtimestamp(inv.created),
            }
            for inv in invoices.data
        ]
