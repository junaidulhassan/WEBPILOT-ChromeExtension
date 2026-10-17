from typing import Annotated

from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.services.rag_service import RAGService


def get_rag_service(request: Request) -> RAGService:
    return request.app.state.rag_service


RagServiceDep = Annotated[RAGService, Depends(get_rag_service)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
