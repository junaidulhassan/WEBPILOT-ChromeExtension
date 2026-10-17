import time
from collections.abc import AsyncIterator

from fastapi import APIRouter, Response, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import RagServiceDep
from app.core.activity import record_activity
from app.core.logging import get_logger
from app.schemas.chat import ChatRequest
from app.services.provider_errors import describe_provider_error
from app.services.rag_service import PreparedAnswer, RAGService

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger("api.chat")

STREAM_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


async def _token_stream(
    rag: RAGService,
    prepared: PreparedAnswer,
    model_key: str | None,
    tone_key: str,
) -> AsyncIterator[str]:
    started = time.perf_counter()
    answer_length = 0

    try:
        async for piece in rag.stream_answer(prepared):
            answer_length += len(piece)
            yield piece
    except Exception as exc:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.exception(f"Answer generation failed after {duration_ms:.1f}ms (model={model_key}, tone={tone_key})")
        record_activity("message_failed", model=model_key, tone=tone_key)
        yield describe_provider_error(exc)
        return

    duration_ms = (time.perf_counter() - started) * 1000
    record_activity(
        "message_answered",
        model=model_key,
        tone=tone_key,
        question_len=len(prepared.question),
        answer_len=answer_length,
        duration_ms=f"{duration_ms:.1f}",
    )


@router.post("/stream")
async def stream_chat(payload: ChatRequest, rag: RagServiceDep) -> StreamingResponse:
    prepared = await rag.prepare_answer(payload.message)
    return StreamingResponse(
        _token_stream(rag, prepared, rag.model_key, rag.tone_key),
        media_type="text/plain; charset=utf-8",
        headers=STREAM_HEADERS,
    )


@router.delete("/memory", status_code=status.HTTP_204_NO_CONTENT)
async def reset_memory(rag: RagServiceDep) -> Response:
    rag.reset_memory()
    record_activity("memory_reset")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
