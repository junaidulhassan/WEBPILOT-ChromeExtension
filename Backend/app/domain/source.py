from dataclasses import dataclass, field
from enum import Enum

from langchain_core.documents import Document


class SourceType(str, Enum):
    WEBSITE = "website"
    PDF = "pdf"
    YOUTUBE = "youtube"


@dataclass(frozen=True)
class LoadedSource:
    source_type: SourceType
    documents: list[Document]
    warning: str | None = None
    chunk_count: int = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "chunk_count", len(self.documents))
