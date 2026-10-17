from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import Settings
from app.domain.source import LoadedSource, SourceType


def build_splitter(settings: Settings) -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        length_function=len,
        is_separator_regex=False,
    )


def degraded_source(
    source_type: SourceType,
    explanation: str,
    warning: str,
    splitter: RecursiveCharacterTextSplitter,
) -> LoadedSource:
    documents = splitter.split_documents([Document(page_content=explanation)])
    return LoadedSource(source_type=source_type, documents=documents, warning=warning)
