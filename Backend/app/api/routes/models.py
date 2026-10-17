from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.api.dependencies import RagServiceDep
from app.core.activity import record_activity
from app.schemas.common import CurrentSelectionResponse, OptionsResponse
from app.schemas.settings import SetModelRequest

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=OptionsResponse)
async def list_models(rag: RagServiceDep) -> OptionsResponse:
    return OptionsResponse(options=rag.list_models(), current=rag.model_key or "")


@router.put("/current", response_model=CurrentSelectionResponse)
async def set_model(payload: SetModelRequest, rag: RagServiceDep) -> CurrentSelectionResponse:
    previous = rag.model_key
    current = await run_in_threadpool(rag.set_model, payload.model)
    record_activity("model_switched", **{"from": previous, "to": current})
    return CurrentSelectionResponse(current=current)
