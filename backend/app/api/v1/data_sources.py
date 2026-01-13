from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.rag import RAGService
from app.schemas.data_source import (
    DataSourceCreate,
    DataSourceUpdate,
    DataSourceResponse,
    DocumentResponse,
    DocumentUploadResponse,
    RAGQueryRequest,
    RAGQueryResponse,
)
from app.api.deps import get_current_user, CurrentUser
from app.config import settings

router = APIRouter(prefix="/data-sources", tags=["Data Sources & RAG"])


@router.get("", response_model=List[DataSourceResponse])
async def list_data_sources(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all data sources for the organization"""
    rag = RAGService(db)
    sources = await rag.list_data_sources(current_user.org_id)

    # Add document count
    results = []
    for source in sources:
        docs = await rag.list_documents(current_user.org_id, source.id)
        results.append(
            DataSourceResponse(
                **{
                    "id": source.id,
                    "organization_id": source.organization_id,
                    "name": source.name,
                    "description": source.description,
                    "type": source.type,
                    "config": source.config,
                    "status": source.status,
                    "error_message": source.error_message,
                    "last_synced_at": source.last_synced_at,
                    "created_at": source.created_at,
                    "updated_at": source.updated_at,
                    "document_count": len(docs),
                }
            )
        )
    return results


@router.post("", response_model=DataSourceResponse)
async def create_data_source(
    data: DataSourceCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new data source"""
    rag = RAGService(db)
    source = await rag.create_data_source(current_user.org_id, data)
    return DataSourceResponse(
        **{
            "id": source.id,
            "organization_id": source.organization_id,
            "name": source.name,
            "description": source.description,
            "type": source.type,
            "config": source.config,
            "status": source.status,
            "error_message": source.error_message,
            "last_synced_at": source.last_synced_at,
            "created_at": source.created_at,
            "updated_at": source.updated_at,
            "document_count": 0,
        }
    )


@router.get("/{data_source_id}", response_model=DataSourceResponse)
async def get_data_source(
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a data source by ID"""
    rag = RAGService(db)
    source = await rag.get_data_source(data_source_id, current_user.org_id)
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    docs = await rag.list_documents(current_user.org_id, source.id)
    return DataSourceResponse(
        **{
            "id": source.id,
            "organization_id": source.organization_id,
            "name": source.name,
            "description": source.description,
            "type": source.type,
            "config": source.config,
            "status": source.status,
            "error_message": source.error_message,
            "last_synced_at": source.last_synced_at,
            "created_at": source.created_at,
            "updated_at": source.updated_at,
            "document_count": len(docs),
        }
    )


@router.delete("/{data_source_id}")
async def delete_data_source(
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a data source and all its documents"""
    rag = RAGService(db)
    success = await rag.delete_data_source(data_source_id, current_user.org_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    return {"message": "Data source deleted"}


# Documents
@router.get("/{data_source_id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List documents in a data source"""
    rag = RAGService(db)
    documents = await rag.list_documents(current_user.org_id, data_source_id)
    return [DocumentResponse.model_validate(d) for d in documents]


@router.post("/{data_source_id}/documents", response_model=DocumentUploadResponse)
async def upload_document(
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Upload a document to a data source"""
    # Check file size
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    rag = RAGService(db)
    try:
        return await rag.upload_document(
            current_user.org_id,
            data_source_id,
            file.filename,
            file.content_type,
            content,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{data_source_id}/documents/{document_id}")
async def delete_document(
    data_source_id: UUID,
    document_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a document"""
    rag = RAGService(db)
    success = await rag.delete_document(document_id, current_user.org_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return {"message": "Document deleted"}


# RAG Query
@router.post("/query", response_model=RAGQueryResponse)
async def query_documents(
    data: RAGQueryRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Query the RAG system"""
    rag = RAGService(db)
    return await rag.query(
        current_user.org_id,
        data.query,
        top_k=data.top_k,
        data_source_ids=data.data_source_ids,
    )
