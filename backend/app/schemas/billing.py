from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class UsageRecordBase(BaseModel):
    input_tokens: int
    output_tokens: int
    request_count: int
    cost: Decimal


class UsageResponse(UsageRecordBase):
    id: UUID
    organization_id: UUID
    subscription_id: Optional[UUID]
    model_id: Optional[UUID]
    recorded_at: datetime

    class Config:
        from_attributes = True


class UsageSummary(BaseModel):
    period_start: datetime
    period_end: datetime
    total_input_tokens: int
    total_output_tokens: int
    total_requests: int
    total_cost: Decimal
    by_model: List["ModelUsageSummary"]


class ModelUsageSummary(BaseModel):
    model_id: UUID
    model_name: str
    input_tokens: int
    output_tokens: int
    requests: int
    cost: Decimal


class InvoiceResponse(BaseModel):
    id: str
    stripe_invoice_id: str
    amount_due: int  # cents
    amount_paid: int
    currency: str
    status: str
    period_start: datetime
    period_end: datetime
    pdf_url: Optional[str]
    created_at: datetime


class PaymentMethodResponse(BaseModel):
    id: str
    type: str  # "card", "bank_account", etc.
    last4: str
    brand: Optional[str]
    exp_month: Optional[int]
    exp_year: Optional[int]
    is_default: bool


class CheckoutSessionRequest(BaseModel):
    model_id: UUID
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str


class BillingPortalResponse(BaseModel):
    url: str
