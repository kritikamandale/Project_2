"""
Product embedding generator — encodes product text into vectors for similarity search.
Uses pgvector (Supabase) when PINECONE_API_KEY is blank (default / free setup).
Set PINECONE_API_KEY to enable Pinecone as the vector store instead.
"""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class ProductEmbeddingService:
    def __init__(self) -> None:
        self._pinecone_index = None
        if settings.pinecone_api_key:
            self._try_init_pinecone()

    def _try_init_pinecone(self) -> None:
        try:
            from pinecone import Pinecone, ServerlessSpec  # type: ignore[import]
            pc = Pinecone(api_key=settings.pinecone_api_key)
            existing = [i.name for i in pc.list_indexes()]
            if settings.pinecone_index_name not in existing:
                pc.create_index(
                    name=settings.pinecone_index_name,
                    dimension=768,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                )
            self._pinecone_index = pc.Index(settings.pinecone_index_name)
            logger.info("Pinecone index '%s' connected.", settings.pinecone_index_name)
        except Exception as exc:
            logger.warning("Pinecone unavailable — vector search disabled. %s", exc)

    async def embed_product(self, product: dict) -> list[float]:
        raise NotImplementedError("Embedding pipeline not yet implemented.")

    async def upsert_products(self, products: list[dict]) -> None:
        raise NotImplementedError("Embedding pipeline not yet implemented.")

    async def search_similar(self, query_vector: list[float], top_k: int = 10) -> list[dict]:
        if self._pinecone_index is None:
            return []
        result = self._pinecone_index.query(vector=query_vector, top_k=top_k, include_metadata=True)
        return [m.metadata for m in result.matches]
