from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.exceptions import ContentUnavailableError
from app.domain.source import LoadedSource, SourceType


def load_text(text: str, splitter: RecursiveCharacterTextSplitter) -> LoadedSource:
    documents = splitter.create_documents([text])
    if not documents:
        raise ContentUnavailableError("This page has no readable text.")
    return LoadedSource(source_type=SourceType.WEBSITE, documents=documents)
