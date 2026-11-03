from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_community.vectorstores import FAISS

from app.core.config import Settings
from app.core.exceptions import ContentUnavailableError, ProviderUnavailableError
from app.core.logging import get_logger

logger = get_logger("vector_store")


def build_retriever(
    documents: list[Document],
    embeddings: Embeddings,
    settings: Settings,
) -> VectorStoreRetriever:
    if not documents:
        raise ContentUnavailableError("There is no readable content to index.")

    logger.info(f"Building vector database from {len(documents)} chunks")
    try:
        store = FAISS.from_documents(documents=documents, embedding=embeddings)
    except Exception as exc:
        logger.exception("Failed to build the vector database")
        raise ProviderUnavailableError(
            "Could not create embeddings for this content. Check the embedding provider and try again."
        ) from exc

    return store.as_retriever(
        search_type="mmr",
        search_kwargs={"k": settings.retriever_k, "fetch_k": settings.retriever_fetch_k},
    )
