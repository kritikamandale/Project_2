"""
Product embedding generator — encodes product text into vectors for Pinecone.
Uses a lightweight sentence-transformer compatible approach via Claude embeddings.
"""

from pinecone import Pinecone, ServerlessSpec

from app.core.config import settings


class ProductEmbeddingService:
    def __init__(self):
        self._pc = Pinecone(api_key=settings.pinecone_api_key)

    def ensure_index(self) -> None:
        """Creates Pinecone index if it doesn't exist (1536 dims for text-embedding-3-small compatible)."""
        existing = [i.name for i in self._pc.list_indexes()]
        if settings.pinecone_index_name not in existing:
            self._pc.create_index(
                name=settings.pinecone_index_name,
                dimension=1536,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )

    async def embed_product(self, product: dict) -> list[float]:
        """
        Converts a product dict to a dense vector.
        Text: "{name} {brand} {category} {ingredients_joined}"
        TODO: call embedding model (OpenAI or Anthropic Claude when available)
        """
        raise NotImplementedError

    async def upsert_products(self, products: list[dict]) -> None:
        """
        Batch-upsert product embeddings to Pinecone.
        TODO: embed all products, chunked upsert to Pinecone index
        """
        raise NotImplementedError

    async def search_similar(self, query_vector: list[float], top_k: int = 10) -> list[dict]:
        index = self._pc.Index(settings.pinecone_index_name)
        result = index.query(vector=query_vector, top_k=top_k, include_metadata=True)
        return [m.metadata for m in result.matches]
