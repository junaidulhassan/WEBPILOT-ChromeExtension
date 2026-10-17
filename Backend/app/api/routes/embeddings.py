from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.api.dependencies import RagServiceDep
from app.core.activity import record_activity
from app.schemas.common import CurrentSelectionResponse, OptionsResponse
from app.schemas.settings import SetEmbeddingRequest

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.get("", response_model=OptionsResponse)
async def list_embeddings(rag: RagServiceDep) -> OptionsResponse:
    return OptionsResponse(options=rag.list_embeddings(), current=rag.embedding_key)


@router.put("/current", response_model=CurrentSelectionResponse)
async def set_embedding(payload: SetEmbeddingRequest, rag: RagServiceDep) -> CurrentSelectionResponse:
    previous = rag.embedding_key
    current = await run_in_threadpool(rag.set_embedding, payload.embedding)
    record_activity("embedding_switched", **{"from": previous, "to": current})
    return CurrentSelectionResponse(current=current)
