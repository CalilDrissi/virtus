from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.models.conversation import MessageRole, ConversationChannel


class ChatMessage(BaseModel):
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    model_id: UUID
    messages: List[ChatMessage]
    conversation_id: Optional[UUID] = None
    use_rag: bool = True
    data_source_ids: Optional[List[UUID]] = None
    stream: bool = True
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None


class ChatResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    content: str
    input_tokens: int
    output_tokens: int
    model_id: UUID
    created_at: datetime
    context_used: Optional[List[Dict[str, Any]]] = None


class StreamChunk(BaseModel):
    type: str  # "content", "usage", "done", "error"
    content: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    conversation_id: Optional[UUID] = None
    message_id: Optional[UUID] = None
    error: Optional[str] = None


class ConversationResponse(BaseModel):
    id: UUID
    organization_id: UUID
    model_id: Optional[UUID]
    channel: ConversationChannel
    title: Optional[str]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class ConversationWithMessages(ConversationResponse):
    messages: List["MessageResponse"]


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: MessageRole
    content: str
    input_tokens: int
    output_tokens: int
    metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
