import time

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.api.dependencies import RagServiceDep, SettingsDep
from app.core.activity import record_activity
from app.core.exceptions import AppError
from app.core.logging import get_logger
from app.schemas.pages import ActiveSelection, ProcessPageRequest, ProcessPageResponse
from app.services.source_resolver import detect_source_type

router = APIRouter(prefix="/pages", tags=["pages"])
logger = get_logger("api.pages")


@router.post("/process", response_model=ProcessPageResponse)
async def process_page(
    payload: ProcessPageRequest,
    rag: RagServiceDep,
    settings: SettingsDep,
) -> ProcessPageResponse:
    started = time.perf_counter()
    history = [turn.model_dump() for turn in payload.history]

    try:
        source_type = await run_in_threadpool(detect_source_type, payload.url, settings.head_request_timeout)
        loaded = await run_in_threadpool(
            rag.load_source,
            source_type,
            url=payload.url,
            text=payload.text,
            history=history,
        )
    except AppError as exc:
        duration_ms = (time.perf_counter() - started) * 1000
        record_activity("page_process_failed", url=payload.url, code=exc.code, duration_ms=f"{duration_ms:.1f}")
        raise

    duration_ms = (time.perf_counter() - started) * 1000
    record_activity(
        "page_processed",
        url=payload.url,
        type=loaded.source_type.value,
        chunks=loaded.chunk_count,
        history_turns=len(history),
        degraded=loaded.warning is not None,
        duration_ms=f"{duration_ms:.1f}",
    )

    return ProcessPageResponse(
        message="Page processed successfully",
        source_type=loaded.source_type,
        chunk_count=loaded.chunk_count,
        warning=loaded.warning,
        active=ActiveSelection(model=rag.model_key, tone=rag.tone_key, embedding=rag.embedding_key),
    )
