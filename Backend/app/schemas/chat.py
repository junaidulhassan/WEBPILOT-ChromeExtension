from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.core.config import get_settings

_settings = get_settings()


class ChatRequest(BaseModel):
    message: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=_settings.max_message_length),
    ]
