import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BACKEND_DIR / ".env")

DEFAULT_CORS_ORIGIN_REGEX = r"^(chrome-extension://.+|https?://(localhost|127\.0\.0\.1)(:\d+)?)$"


def _read_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_name: str = "WebPilot AI Backend"
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"
    log_dir: Path = BACKEND_DIR / "logs"
    log_max_bytes: int = 2 * 1024 * 1024
    log_backup_count: int = 3
    cors_origin_regex: str = DEFAULT_CORS_ORIGIN_REGEX

    google_api_key: str = ""
    groq_api_key: str = ""

    chunk_size: int = 1500
    chunk_overlap: int = 40
    retriever_k: int = 10
    retriever_fetch_k: int = 50
    memory_window: int = 3

    default_temperature: float = 0.2
    default_max_tokens: int = 4096

    head_request_timeout: float = 5.0
    max_message_length: int = 8000
    max_page_text_length: int = 5_000_000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        host=os.getenv("HOST", "127.0.0.1"),
        port=_read_int("PORT", 8000),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        cors_origin_regex=os.getenv("CORS_ORIGIN_REGEX", DEFAULT_CORS_ORIGIN_REGEX),
        google_api_key=os.getenv("GOOGLE_API_KEY", ""),
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
    )
