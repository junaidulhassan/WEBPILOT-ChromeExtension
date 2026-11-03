import re
from urllib.parse import parse_qs, urlparse

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled, VideoUnavailable

from app.core.logging import get_logger
from app.domain.source import LoadedSource, SourceType
from app.services.loaders import messages
from app.services.loaders.base import degraded_source

logger = get_logger("loaders.youtube")

ENGLISH_LANGUAGE_CODES = ["en", "en-US", "en-GB"]
EMBEDDED_PATH_PREFIXES = ("/embed/", "/v/", "/shorts/", "/live/")
VIDEO_ID_PATTERN = re.compile(r"([0-9A-Za-z_-]{11})")


def extract_video_id(youtube_url: str) -> str | None:
    parsed = urlparse(youtube_url)
    hostname = (parsed.hostname or "").lower()

    if hostname == "youtu.be":
        return parsed.path.lstrip("/").split("/")[0] or None

    if "youtube" in hostname:
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
        for prefix in EMBEDDED_PATH_PREFIXES:
            if parsed.path.startswith(prefix):
                return parsed.path[len(prefix):].split("/")[0]

    match = VIDEO_ID_PATTERN.search(youtube_url)
    return match.group(1) if match else None


def _fetch_english_transcript(video_id: str) -> str:
    transcripts = YouTubeTranscriptApi().list(video_id)

    try:
        transcript = transcripts.find_transcript(ENGLISH_LANGUAGE_CODES)
    except NoTranscriptFound:
        transcript = next(iter(transcripts))
        if transcript.is_translatable:
            transcript = transcript.translate("en")

    return " ".join(snippet.text for snippet in transcript.fetch()).strip()


def load_youtube(youtube_url: str, splitter: RecursiveCharacterTextSplitter) -> LoadedSource:
    video_id = extract_video_id(youtube_url)
    if not video_id:
        logger.warning(f"Could not extract a YouTube video ID from URL: {youtube_url}")
        return degraded_source(
            SourceType.YOUTUBE, messages.INVALID_OR_UNAVAILABLE_VIDEO, messages.WARNING_INVALID_VIDEO, splitter
        )

    try:
        text = _fetch_english_transcript(video_id)
    except (TranscriptsDisabled, NoTranscriptFound, StopIteration):
        logger.warning(f"Video does not have an available transcript: {youtube_url}")
        return degraded_source(
            SourceType.YOUTUBE, messages.NO_ENGLISH_TRANSCRIPT, messages.WARNING_NO_ENGLISH_TRANSCRIPT, splitter
        )
    except VideoUnavailable:
        logger.warning(f"Video is unavailable: {youtube_url}")
        return degraded_source(
            SourceType.YOUTUBE, messages.INVALID_OR_UNAVAILABLE_VIDEO, messages.WARNING_INVALID_VIDEO, splitter
        )
    except Exception:
        logger.exception(f"Video transcript error occurred: {youtube_url}")
        return degraded_source(
            SourceType.YOUTUBE, messages.NO_ENGLISH_TRANSCRIPT, messages.WARNING_NO_ENGLISH_TRANSCRIPT, splitter
        )

    if not text:
        logger.warning(f"Video transcript was empty: {youtube_url}")
        return degraded_source(
            SourceType.YOUTUBE, messages.EMPTY_TRANSCRIPT, messages.WARNING_EMPTY_TRANSCRIPT, splitter
        )

    document = Document(page_content=text, metadata={"source": youtube_url})
    return LoadedSource(source_type=SourceType.YOUTUBE, documents=splitter.split_documents([document]))
