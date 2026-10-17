from app.core.config import Settings
from app.domain.source import LoadedSource, SourceType
from app.services.loaders.base import build_splitter
from app.services.loaders.pdf import load_pdf
from app.services.loaders.text import load_text
from app.services.loaders.youtube import extract_video_id, load_youtube


def load_documents(
    source_type: SourceType,
    *,
    url: str,
    text: str,
    settings: Settings,
    pdf_location: str | None = None,
) -> LoadedSource:
    splitter = build_splitter(settings)

    if source_type is SourceType.PDF:
        return load_pdf(pdf_location or url, splitter)
    if source_type is SourceType.YOUTUBE:
        return load_youtube(url, splitter)
    return load_text(text, splitter)


__all__ = ["extract_video_id", "load_documents"]
