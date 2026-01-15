import os
import uuid
import aiofiles
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.data_source import DataSource, Document, ProcessingStatus
from app.schemas.data_source import DocumentUploadResponse, RAGQueryResponse, RAGChunk
from app.services.embeddings import EmbeddingsService
from app.utils.chunking import chunk_text, extract_text
from app.config import settings


class RAGService:
    """Service for RAG pipeline operations"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.embeddings = EmbeddingsService()

    async def get_data_source(
        self, data_source_id: UUID, model_id: UUID
    ) -> Optional[DataSource]:
        """Get a data source by ID"""
        result = await self.db.execute(
            select(DataSource).where(
                DataSource.id == data_source_id,
                DataSource.model_id == model_id,
            )
        )
        return result.scalar_one_or_none()

    async def upload_document(
        self,
        model_id: UUID,
        data_source_id: UUID,
        filename: str,
        content_type: str,
        file_content: bytes,
    ) -> DocumentUploadResponse:
        """Upload and process a document"""
        # Verify data source exists
        data_source = await self.get_data_source(data_source_id, model_id)
        if not data_source:
            raise ValueError("Data source not found")

        # Create storage directory (use model_id for organization)
        storage_dir = os.path.join(settings.UPLOAD_DIR, str(model_id))
        os.makedirs(storage_dir, exist_ok=True)

        # Generate unique filename
        file_ext = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        storage_path = os.path.join(storage_dir, unique_filename)

        # Save file
        async with aiofiles.open(storage_path, "wb") as f:
            await f.write(file_content)

        # Create document record
        document = Document(
            data_source_id=data_source_id,
            filename=unique_filename,
            original_filename=filename,
            content_type=content_type,
            file_size=len(file_content),
            storage_path=storage_path,
            status=ProcessingStatus.PROCESSING,
        )
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)

        # Process document asynchronously (in production, use background task)
        try:
            await self._process_document(document, model_id)
            document.status = ProcessingStatus.READY
            await self.db.commit()

            return DocumentUploadResponse(
                id=document.id,
                filename=filename,
                status=document.status,
                message=f"Document processed successfully. {document.chunk_count} chunks created.",
            )
        except Exception as e:
            document.status = ProcessingStatus.ERROR
            document.error_message = str(e)
            await self.db.commit()

            return DocumentUploadResponse(
                id=document.id,
                filename=filename,
                status=document.status,
                message=f"Error processing document: {str(e)}",
            )

    async def _process_document(self, document: Document, model_id: UUID) -> None:
        """Process a document: extract text, chunk, and embed"""
        # Extract text
        text = extract_text(document.storage_path, document.content_type)

        # Chunk text
        chunks = chunk_text(
            text,
            metadata={
                "document_id": str(document.id),
                "data_source_id": str(document.data_source_id),
                "filename": document.original_filename,
            },
        )

        # Store embeddings (use model_id as collection namespace)
        chunk_count = await self.embeddings.store_chunks(
            str(model_id),
            str(document.id),
            chunks,
        )

        document.chunk_count = chunk_count

    async def delete_document(self, document_id: UUID) -> bool:
        """Delete a document and its chunks"""
        result = await self.db.execute(
            select(Document)
            .join(DataSource)
            .where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        if not document:
            return False

        # Get model_id from data source
        ds_result = await self.db.execute(
            select(DataSource).where(DataSource.id == document.data_source_id)
        )
        data_source = ds_result.scalar_one_or_none()
        model_id = data_source.model_id if data_source else None

        # Delete chunks from vector store
        if model_id:
            await self.embeddings.delete_document_chunks(
                str(model_id), str(document_id)
            )

        # Delete file
        if os.path.exists(document.storage_path):
            os.remove(document.storage_path)

        await self.db.delete(document)
        await self.db.commit()
        return True

    async def query(
        self,
        model_id: UUID,
        query: str,
        top_k: int = 5,
    ) -> RAGQueryResponse:
        """Query the RAG system for a model's data sources"""
        results = await self.embeddings.search(
            str(model_id),
            query,
            top_k=top_k,
        )

        chunks = []
        for result in results:
            # Get document name
            doc_id = result.get("document_id")
            doc_name = "Unknown"
            if doc_id:
                doc_result = await self.db.execute(
                    select(Document).where(Document.id == UUID(doc_id))
                )
                doc = doc_result.scalar_one_or_none()
                if doc:
                    doc_name = doc.original_filename

            chunks.append(
                RAGChunk(
                    content=result["content"],
                    document_id=UUID(doc_id) if doc_id else None,
                    document_name=doc_name,
                    score=result["score"],
                    metadata=result.get("metadata", {}),
                )
            )

        return RAGQueryResponse(chunks=chunks, query=query)

    def format_context(self, chunks: List[RAGChunk]) -> str:
        """Format RAG chunks as context for the AI model"""
        if not chunks:
            return ""

        context_parts = ["Here is relevant context from the knowledge base:\n"]
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(
                f"[Source {i}: {chunk.document_name}]\n{chunk.content}\n"
            )
        context_parts.append("\nUse this context to help answer the user's question.")

        return "\n".join(context_parts)
