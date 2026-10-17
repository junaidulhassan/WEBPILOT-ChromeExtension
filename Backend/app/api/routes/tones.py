from fastapi import APIRouter

from app.api.dependencies import RagServiceDep
from app.core.activity import record_activity
from app.schemas.common import CurrentSelectionResponse, OptionsResponse
from app.schemas.settings import SetToneRequest

router = APIRouter(prefix="/tones", tags=["tones"])


@router.get("", response_model=OptionsResponse)
async def list_tones(rag: RagServiceDep) -> OptionsResponse:
    return OptionsResponse(options=rag.list_tones(), current=rag.tone_key)


@router.put("/current", response_model=CurrentSelectionResponse)
async def set_tone(payload: SetToneRequest, rag: RagServiceDep) -> CurrentSelectionResponse:
    previous = rag.tone_key
    current = rag.set_tone(payload.tone)
    record_activity("tone_switched", **{"from": previous, "to": current})
    return CurrentSelectionResponse(current=current)
