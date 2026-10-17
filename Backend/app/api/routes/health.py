from fastapi import APIRouter

from app import __version__
from app.api.dependencies import RagServiceDep
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(rag: RagServiceDep) -> HealthResponse:
    ready = rag.llm_ready and rag.embedding_ready
    return HealthResponse(
        status="ok" if ready else "degraded",
        version=__version__,
        llm_ready=rag.llm_ready,
        embedding_ready=rag.embedding_ready,
        page_loaded=rag.page_loaded,
    )
