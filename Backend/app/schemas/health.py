from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str
    llm_ready: bool
    embedding_ready: bool
    page_loaded: bool
