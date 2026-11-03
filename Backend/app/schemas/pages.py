from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.core.config import get_settings
from app.domain.source import SourceType
from app.schemas.common import NonEmptyStr

_settings = get_settings()


class ChatTurn(BaseModel):
    question: str
    answer: str


class ProcessPageRequest(BaseModel):
    url: NonEmptyStr
    text: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=_settings.max_page_text_length),
    ]
    history: list[ChatTurn] = Field(default_factory=list)


class ActiveSelection(BaseModel):
    model: str | None
    tone: str
    embedding: str


class ProcessPageResponse(BaseModel):
    message: str
    source_type: SourceType
    chunk_count: int
    warning: str | None = None
    active: ActiveSelection
