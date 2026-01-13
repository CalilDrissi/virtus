import json
from typing import Annotated, List, Optional
from uuid import UUID, uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db, AsyncSessionLocal
from app.models.ai_model import AIModel
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.conversation import Conversation, Message, ConversationChannel, MessageRole
from app.schemas.chat import ChatRequest, ChatResponse, StreamChunk, ConversationResponse, ConversationWithMessages, MessageResponse
from app.services.model_registry import ModelRegistry
from app.services.rag import RAGService
from app.services.usage_tracker import UsageTracker
from app.services.billing import BillingService
from app.providers.base import Message as ProviderMessage
from app.api.deps import get_current_user, CurrentUser

router = APIRouter(prefix="/chat", tags=["Chat"])


async def verify_model_access(
    db: AsyncSession,
    organization_id: UUID,
    model_id: UUID,
) -> tuple[AIModel, Optional[Subscription]]:
    """Verify organization has access to the model"""
    # Get model
    result = await db.execute(
        select(AIModel)
        .where(AIModel.id == model_id, AIModel.is_active == True)
        .options(selectinload(AIModel.pricing))
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    # Check subscription
    result = await db.execute(
        select(Subscription).where(
            Subscription.organization_id == organization_id,
            Subscription.model_id == model_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
        )
    )
    subscription = result.scalar_one_or_none()

    # If model requires subscription and none exists
    if model.pricing and model.pricing.monthly_subscription_price > 0:
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Subscription required for this model",
            )

    return model, subscription


@router.post("/completions", response_model=ChatResponse)
async def create_completion(
    data: ChatRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a chat completion (non-streaming)"""
    model, subscription = await verify_model_access(db, current_user.org_id, data.model_id)

    # Check usage limits
    if subscription:
        usage_tracker = UsageTracker(db)
        limits = await usage_tracker.check_usage_limits(subscription.id)
        if not limits["allowed"]:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=limits["reason"])

    # Get or create conversation
    if data.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == data.conversation_id,
                Conversation.organization_id == current_user.org_id,
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    else:
        conversation = Conversation(
            organization_id=current_user.org_id,
            model_id=data.model_id,
            channel=ConversationChannel.API,
        )
        db.add(conversation)
        await db.flush()

    # Get RAG context if enabled
    context = ""
    context_chunks = []
    if data.use_rag:
        rag = RAGService(db)
        user_query = data.messages[-1].content if data.messages else ""
        rag_result = await rag.query(
            current_user.org_id,
            user_query,
            data_source_ids=data.data_source_ids,
        )
        context = rag.format_context(rag_result.chunks)
        context_chunks = [{"content": c.content, "document": c.document_name} for c in rag_result.chunks]

    # Prepare messages for provider
    registry = ModelRegistry(db)
    provider = registry.get_provider(model)

    system_prompt = model.system_prompt or ""
    if context:
        system_prompt = f"{system_prompt}\n\n{context}"

    provider_messages = [
        ProviderMessage(role=m.role.value, content=m.content)
        for m in data.messages
    ]

    # Generate completion
    result = await provider.complete(
        messages=provider_messages,
        model=model.provider_model_id,
        max_tokens=data.max_tokens or model.max_tokens,
        temperature=data.temperature or float(model.temperature),
        system_prompt=system_prompt,
    )

    # Save messages
    for msg in data.messages:
        db.add(Message(
            conversation_id=conversation.id,
            role=MessageRole(msg.role.value),
            content=msg.content,
        ))

    assistant_message = Message(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content=result.content,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        metadata={"context": context_chunks} if context_chunks else {},
    )
    db.add(assistant_message)

    # Track usage
    usage_tracker = UsageTracker(db)
    await usage_tracker.record_usage(
        current_user.org_id,
        data.model_id,
        result.input_tokens,
        result.output_tokens,
        subscription.id if subscription else None,
    )

    # Report to Stripe if applicable
    if subscription:
        billing = BillingService(db)
        await billing.report_usage(subscription, result.input_tokens, result.output_tokens)

    await db.commit()
    await db.refresh(assistant_message)

    return ChatResponse(
        id=assistant_message.id,
        conversation_id=conversation.id,
        content=result.content,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        model_id=data.model_id,
        created_at=assistant_message.created_at,
        context_used=context_chunks if context_chunks else None,
    )


@router.post("/completions/stream")
async def create_streaming_completion(
    data: ChatRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a streaming chat completion"""
    model, subscription = await verify_model_access(db, current_user.org_id, data.model_id)

    async def generate():
        async with AsyncSessionLocal() as stream_db:
            try:
                # Create conversation
                conversation = Conversation(
                    organization_id=current_user.org_id,
                    model_id=data.model_id,
                    channel=ConversationChannel.API,
                )
                stream_db.add(conversation)
                await stream_db.flush()

                # Get RAG context
                context = ""
                if data.use_rag:
                    rag = RAGService(stream_db)
                    user_query = data.messages[-1].content if data.messages else ""
                    rag_result = await rag.query(
                        current_user.org_id,
                        user_query,
                        data_source_ids=data.data_source_ids,
                    )
                    context = rag.format_context(rag_result.chunks)

                # Prepare provider
                registry = ModelRegistry(stream_db)
                provider = registry.get_provider(model)

                system_prompt = model.system_prompt or ""
                if context:
                    system_prompt = f"{system_prompt}\n\n{context}"

                provider_messages = [
                    ProviderMessage(role=m.role.value, content=m.content)
                    for m in data.messages
                ]

                # Stream response
                full_content = ""
                async for chunk in provider.stream(
                    messages=provider_messages,
                    model=model.provider_model_id,
                    max_tokens=data.max_tokens or model.max_tokens,
                    temperature=data.temperature or float(model.temperature),
                    system_prompt=system_prompt,
                ):
                    full_content += chunk
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

                # Count tokens
                input_tokens = await provider.count_tokens(
                    " ".join(m.content for m in data.messages),
                    model.provider_model_id,
                )
                output_tokens = await provider.count_tokens(full_content, model.provider_model_id)

                # Save messages
                for msg in data.messages:
                    stream_db.add(Message(
                        conversation_id=conversation.id,
                        role=MessageRole(msg.role.value),
                        content=msg.content,
                    ))

                message_id = uuid4()
                stream_db.add(Message(
                    id=message_id,
                    conversation_id=conversation.id,
                    role=MessageRole.ASSISTANT,
                    content=full_content,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                ))

                # Track usage
                usage_tracker = UsageTracker(stream_db)
                await usage_tracker.record_usage(
                    current_user.org_id,
                    data.model_id,
                    input_tokens,
                    output_tokens,
                    subscription.id if subscription else None,
                )

                await stream_db.commit()

                yield f"data: {json.dumps({'type': 'usage', 'input_tokens': input_tokens, 'output_tokens': output_tokens})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'conversation_id': str(conversation.id), 'message_id': str(message_id)})}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


# Conversations
@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 20,
    offset: int = 0,
):
    """List conversations"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.organization_id == current_user.org_id)
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    conversations = result.scalars().all()
    return [ConversationResponse.model_validate(c) for c in conversations]


@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conversation_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a conversation with messages"""
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.organization_id == current_user.org_id,
        )
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return ConversationWithMessages(
        **ConversationResponse.model_validate(conversation).model_dump(),
        messages=[MessageResponse.model_validate(m) for m in conversation.messages],
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a conversation"""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.organization_id == current_user.org_id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    await db.delete(conversation)
    await db.commit()
    return {"message": "Conversation deleted"}
