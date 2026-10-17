from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.logging import get_logger
from app.domain.source import LoadedSource, SourceType
from app.services.loaders import messages
from app.services.loaders.base import degraded_source

logger = get_logger("loaders.pdf")


def load_pdf(location: str, splitter: RecursiveCharacterTextSplitter) -> LoadedSource:
    try:
        pages = PyPDFLoader(file_path=location).load()
    except Exception:
        logger.exception(f"Error loading PDF file: {location}")
        return degraded_source(SourceType.PDF, messages.INVALID_PDF, messages.WARNING_INVALID_PDF, splitter)

    readable_pages = [page for page in pages if page.page_content.strip()]
    if not readable_pages:
        logger.warning(f"PDF file has no readable text or data: {location}")
        return degraded_source(SourceType.PDF, messages.EMPTY_PDF, messages.WARNING_EMPTY_PDF, splitter)

    logger.info(f"PDF loaded successfully: {len(readable_pages)}/{len(pages)} readable pages")
    return LoadedSource(source_type=SourceType.PDF, documents=splitter.split_documents(readable_pages))
