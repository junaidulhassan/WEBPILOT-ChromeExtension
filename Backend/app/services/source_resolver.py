import re
from urllib.parse import unquote, urlparse

import requests

from app.core.logging import get_logger
from app.domain.source import SourceType

logger = get_logger("source_resolver")

YOUTUBE_PATTERN = re.compile(
    r"(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/.+",
    re.IGNORECASE,
)
HTTP_PREFIXES = ("http://", "https://")


def is_youtube_url(url: str) -> bool:
    return bool(YOUTUBE_PATTERN.match(url))


def resolve_pdf_location(url: str) -> str:
    if url.startswith(HTTP_PREFIXES):
        return url
    return unquote(urlparse(url).path)


def _serves_pdf(url: str, timeout: float) -> bool:
    if not url.startswith(HTTP_PREFIXES):
        return False
    try:
        response = requests.head(url, allow_redirects=True, timeout=timeout)
    except requests.RequestException as exc:
        logger.warning(f"PDF check request failed for {url}: {exc}")
        return False
    is_pdf = "application/pdf" in response.headers.get("Content-Type", "").lower()
    logger.debug(f"PDF content-type check for {url}: {is_pdf}")
    return is_pdf


def detect_source_type(url: str, head_timeout: float) -> SourceType:
    if url.lower().endswith(".pdf"):
        return SourceType.PDF
    if is_youtube_url(url):
        return SourceType.YOUTUBE
    if _serves_pdf(url, head_timeout):
        return SourceType.PDF
    return SourceType.WEBSITE
