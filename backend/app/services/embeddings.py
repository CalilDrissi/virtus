from typing import List
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.config import settings
from app.providers.openai_provider import OpenAIProvider


class EmbeddingsService:
    """Service for generating and storing embeddings"""

    def __init__(self):
        self.qdrant = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            api_key=settings.QDRANT_API_KEY,
        )
        self.openai = OpenAIProvider({})
        self.dimension = settings.EMBEDDING_DIMENSION

    def get_collection_name(self, organization_id: str) -> str:
        """Get Qdrant collection name for an organization"""
        return f"org_{organization_id.replace('-', '_')}"

    async def ensure_collection(self, organization_id: str) -> None:
        """Ensure the collection exists for an organization"""
        collection_name = self.get_collection_name(organization_id)

        try:
            self.qdrant.get_collection(collection_name)
        except Exception:
            self.qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=self.dimension,
                    distance=models.Distance.COSINE,
                ),
            )

    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using OpenAI"""
        return await self.openai.get_embeddings(texts)

    async def store_chunks(
        self,
        organization_id: str,
        document_id: str,
        chunks: List[dict],
    ) -> int:
        """Store document chunks with their embeddings"""
        if not chunks:
            return 0

        await self.ensure_collection(organization_id)
        collection_name = self.get_collection_name(organization_id)

        # Generate embeddings for all chunks
        texts = [chunk["content"] for chunk in chunks]
        embeddings = await self.generate_embeddings(texts)

        # Create points for Qdrant
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = f"{document_id}_{i}"
            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "content": chunk["content"],
                        "document_id": document_id,
                        "organization_id": organization_id,
                        **chunk.get("metadata", {}),
                    },
                )
            )

        # Upsert points in batches
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            self.qdrant.upsert(
                collection_name=collection_name,
                points=batch,
            )

        return len(points)

    async def search(
        self,
        organization_id: str,
        query: str,
        top_k: int = 5,
        data_source_ids: List[str] = None,
    ) -> List[dict]:
        """Search for similar chunks"""
        collection_name = self.get_collection_name(organization_id)

        try:
            self.qdrant.get_collection(collection_name)
        except Exception:
            return []

        # Generate query embedding
        query_embedding = (await self.generate_embeddings([query]))[0]

        # Build filter
        filter_conditions = []
        if data_source_ids:
            filter_conditions.append(
                models.FieldCondition(
                    key="data_source_id",
                    match=models.MatchAny(any=data_source_ids),
                )
            )

        search_filter = None
        if filter_conditions:
            search_filter = models.Filter(must=filter_conditions)

        # Search
        results = self.qdrant.search(
            collection_name=collection_name,
            query_vector=query_embedding,
            limit=top_k,
            query_filter=search_filter,
        )

        return [
            {
                "content": hit.payload.get("content", ""),
                "document_id": hit.payload.get("document_id"),
                "score": hit.score,
                "metadata": {
                    k: v
                    for k, v in hit.payload.items()
                    if k not in ["content", "document_id", "organization_id"]
                },
            }
            for hit in results
        ]

    async def delete_document_chunks(
        self, organization_id: str, document_id: str
    ) -> bool:
        """Delete all chunks for a document"""
        collection_name = self.get_collection_name(organization_id)

        try:
            self.qdrant.delete(
                collection_name=collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id",
                                match=models.MatchValue(value=document_id),
                            )
                        ]
                    )
                ),
            )
            return True
        except Exception:
            return False

    async def delete_organization_data(self, organization_id: str) -> bool:
        """Delete all data for an organization"""
        collection_name = self.get_collection_name(organization_id)
        try:
            self.qdrant.delete_collection(collection_name)
            return True
        except Exception:
            return False
