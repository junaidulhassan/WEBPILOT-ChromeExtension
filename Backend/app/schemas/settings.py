from pydantic import BaseModel

from app.schemas.common import NonEmptyStr


class SetModelRequest(BaseModel):
    model: NonEmptyStr


class SetToneRequest(BaseModel):
    tone: NonEmptyStr


class SetEmbeddingRequest(BaseModel):
    embedding: NonEmptyStr
