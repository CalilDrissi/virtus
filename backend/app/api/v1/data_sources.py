from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.ai_model import AIModel
from app.models.subscription import Subscription
from app.models.data_source import DataSource, Document
from app.services.rag import RAGService
from app.schemas.data_source import (
    DataSourceCreate,
    DataSourceResponse,
    DocumentResponse,
    DocumentUploadResponse,
    RAGQueryRequest,
    RAGQueryResponse,
)
from app.api.deps import get_current_user, CurrentUser
from app.config import settings

router = APIRouter(prefix="/models", tags=["Model Data Sources"])


async def verify_model_access(model_id: UUID, db: AsyncSession) -> AIModel:
    """Verify model exists and return it"""
    result = await db.execute(select(AIModel).where(AIModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return model


@router.get("/{model_id}/data-sources", response_model=List[DataSourceResponse])
async def list_model_data_sources(
    model_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all data sources for a model"""
    await verify_model_access(model_id, db)

    result = await db.execute(
        select(DataSource).where(DataSource.model_id == model_id)
    )
    sources = result.scalars().all()

    # Get document counts
    results = []
    for source in sources:
        doc_result = await db.execute(
            select(Document).where(Document.data_source_id == source.id)
        )
        docs = doc_result.scalars().all()
        results.append(
            DataSourceResponse(
                id=source.id,
                model_id=source.model_id,
                name=source.name,
                description=source.description,
                type=source.type,
                config=source.config,
                status=source.status,
                error_message=source.error_message,
                last_synced_at=source.last_synced_at,
                created_at=source.created_at,
                updated_at=source.updated_at,
                document_count=len(docs),
            )
        )
    return results


@router.post("/{model_id}/data-sources", response_model=DataSourceResponse)
async def create_model_data_source(
    model_id: UUID,
    data: DataSourceCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new data source for a model"""
    await verify_model_access(model_id, db)

    source = DataSource(
        model_id=model_id,
        name=data.name,
        description=data.description,
        type=data.type,
        config=data.config or {},
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)

    return DataSourceResponse(
        id=source.id,
        model_id=source.model_id,
        name=source.name,
        description=source.description,
        type=source.type,
        config=source.config,
        status=source.status,
        error_message=source.error_message,
        last_synced_at=source.last_synced_at,
        created_at=source.created_at,
        updated_at=source.updated_at,
        document_count=0,
    )


@router.get("/{model_id}/data-sources/{data_source_id}", response_model=DataSourceResponse)
async def get_model_data_source(
    model_id: UUID,
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a data source by ID"""
    await verify_model_access(model_id, db)

    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id,
            DataSource.model_id == model_id
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    doc_result = await db.execute(
        select(Document).where(Document.data_source_id == source.id)
    )
    docs = doc_result.scalars().all()

    return DataSourceResponse(
        id=source.id,
        model_id=source.model_id,
        name=source.name,
        description=source.description,
        type=source.type,
        config=source.config,
        status=source.status,
        error_message=source.error_message,
        last_synced_at=source.last_synced_at,
        created_at=source.created_at,
        updated_at=source.updated_at,
        document_count=len(docs),
    )


@router.delete("/{model_id}/data-sources/{data_source_id}")
async def delete_model_data_source(
    model_id: UUID,
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a data source and all its documents"""
    await verify_model_access(model_id, db)

    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id,
            DataSource.model_id == model_id
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    await db.delete(source)
    await db.commit()
    return {"message": "Data source deleted"}


# Documents
@router.get("/{model_id}/data-sources/{data_source_id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    model_id: UUID,
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List documents in a data source"""
    await verify_model_access(model_id, db)

    # Verify data source belongs to model
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id,
            DataSource.model_id == model_id
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    doc_result = await db.execute(
        select(Document).where(Document.data_source_id == data_source_id)
    )
    documents = doc_result.scalars().all()
    return [DocumentResponse.model_validate(d) for d in documents]


@router.post("/{model_id}/data-sources/{data_source_id}/documents", response_model=DocumentUploadResponse)
async def upload_document(
    model_id: UUID,
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Upload a document to a data source"""
    await verify_model_access(model_id, db)

    # Verify data source belongs to model
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id,
            DataSource.model_id == model_id
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

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
            model_id,
            data_source_id,
            file.filename,
            file.content_type,
            content,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{model_id}/data-sources/{data_source_id}/documents/{document_id}")
async def delete_document(
    model_id: UUID,
    data_source_id: UUID,
    document_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a document"""
    await verify_model_access(model_id, db)

    # Verify document belongs to data source and model
    result = await db.execute(
        select(Document)
        .join(DataSource)
        .where(
            Document.id == document_id,
            Document.data_source_id == data_source_id,
            DataSource.model_id == model_id
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    rag = RAGService(db)
    await rag.delete_document(document_id)
    return {"message": "Document deleted"}


# Subscription Data Sources Router
subscription_ds_router = APIRouter(prefix="/subscriptions", tags=["Subscription Data Sources"])


async def verify_subscription_access(subscription_id: UUID, user: CurrentUser, db: AsyncSession) -> Subscription:
    """Verify subscription exists and user has access"""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.id == subscription_id)
        .options(selectinload(Subscription.model))
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    if subscription.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return subscription


@subscription_ds_router.get("/{subscription_id}/data-sources", response_model=List[DataSourceResponse])
async def list_subscription_data_sources(
    subscription_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List data sources for a subscription (includes model defaults + user-specific)"""
    subscription = await verify_subscription_access(subscription_id, current_user, db)

    # Get model-level data sources (subscription_id is NULL)
    model_sources_result = await db.execute(
        select(DataSource).where(
            DataSource.model_id == subscription.model_id,
            DataSource.subscription_id.is_(None)
        )
    )
    model_sources = model_sources_result.scalars().all()

    # Get subscription-specific data sources
    sub_sources_result = await db.execute(
        select(DataSource).where(DataSource.subscription_id == subscription_id)
    )
    sub_sources = sub_sources_result.scalars().all()

    all_sources = list(model_sources) + list(sub_sources)

    # Get document counts
    results = []
    for source in all_sources:
        doc_result = await db.execute(
            select(Document).where(Document.data_source_id == source.id)
        )
        docs = doc_result.scalars().all()
        results.append(
            DataSourceResponse(
                id=source.id,
                model_id=source.model_id,
                subscription_id=source.subscription_id,
                name=source.name,
                description=source.description,
                type=source.type,
                config=source.config,
                status=source.status,
                error_message=source.error_message,
                last_synced_at=source.last_synced_at,
                created_at=source.created_at,
                updated_at=source.updated_at,
                document_count=len(docs),
            )
        )
    return results


@subscription_ds_router.post("/{subscription_id}/data-sources", response_model=DataSourceResponse)
async def create_subscription_data_source(
    subscription_id: UUID,
    data: DataSourceCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new data source for a subscription"""
    subscription = await verify_subscription_access(subscription_id, current_user, db)

    source = DataSource(
        model_id=subscription.model_id,
        subscription_id=subscription_id,
        name=data.name,
        description=data.description,
        type=data.type,
        config=data.config or {},
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)

    return DataSourceResponse(
        id=source.id,
        model_id=source.model_id,
        subscription_id=source.subscription_id,
        name=source.name,
        description=source.description,
        type=source.type,
        config=source.config,
        status=source.status,
        error_message=source.error_message,
        last_synced_at=source.last_synced_at,
        created_at=source.created_at,
        updated_at=source.updated_at,
        document_count=0,
    )


@subscription_ds_router.delete("/{subscription_id}/data-sources/{data_source_id}")
async def delete_subscription_data_source(
    subscription_id: UUID,
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a subscription's data source (only user-created ones)"""
    await verify_subscription_access(subscription_id, current_user, db)

    # Only allow deleting user's own data sources (subscription_id must match)
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id,
            DataSource.subscription_id == subscription_id
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found or cannot delete model-level data sources"
        )

    await db.delete(source)
    await db.commit()
    return {"message": "Data source deleted"}


@subscription_ds_router.post("/{subscription_id}/data-sources/{data_source_id}/documents", response_model=DocumentUploadResponse)
async def upload_subscription_document(
    subscription_id: UUID,
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Upload a document to a subscription's data source"""
    subscription = await verify_subscription_access(subscription_id, current_user, db)

    # Only allow uploading to user's own data sources
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id,
            DataSource.subscription_id == subscription_id
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found or cannot upload to model-level data sources"
        )

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
            subscription.model_id,
            data_source_id,
            file.filename,
            file.content_type,
            content,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@subscription_ds_router.get("/{subscription_id}/data-sources/{data_source_id}/documents", response_model=List[DocumentResponse])
async def list_subscription_documents(
    subscription_id: UUID,
    data_source_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List documents in a subscription's data source"""
    subscription = await verify_subscription_access(subscription_id, current_user, db)

    # Verify data source belongs to this subscription
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == data_source_id,
            DataSource.subscription_id == subscription_id
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    doc_result = await db.execute(
        select(Document).where(Document.data_source_id == data_source_id)
    )
    documents = doc_result.scalars().all()
    return [DocumentResponse.model_validate(d) for d in documents]


# RAG Query - still available for querying model's data sources
rag_router = APIRouter(prefix="/data-sources", tags=["RAG Query"])


@rag_router.post("/query", response_model=RAGQueryResponse)
async def query_documents(
    data: RAGQueryRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Query the RAG system for a specific model"""
    if not data.model_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="model_id is required")

    rag = RAGService(db)
    return await rag.query(
        data.model_id,
        data.query,
        top_k=data.top_k,
    )
