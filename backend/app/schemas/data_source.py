from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from app.models.data_source import DataSourceType, ProcessingStatus


class DataSourceBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: DataSourceType


class DataSourceCreate(DataSourceBase):
    config: Dict[str, Any] = {}


class DataSourceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class DataSourceResponse(DataSourceBase):
    id: UUID
    model_id: UUID
    config: Dict[str, Any]
    status: ProcessingStatus
    error_message: Optional[str]
    last_synced_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    document_count: int = 0

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    filename: str


class DocumentResponse(DocumentBase):
    id: UUID
    data_source_id: UUID
    original_filename: str
    content_type: str
    file_size: int
    chunk_count: int
    status: ProcessingStatus
    error_message: Optional[str]
    doc_metadata: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentUploadResponse(BaseModel):
    id: UUID
    filename: str
    status: ProcessingStatus
    message: str


class RAGQueryRequest(BaseModel):
    query: str
    model_id: UUID
    top_k: int = 5


class RAGChunk(BaseModel):
    content: str
    document_id: UUID
    document_name: str
    score: float
    metadata: Dict[str, Any]


class RAGQueryResponse(BaseModel):
    chunks: List[RAGChunk]
    query: str
