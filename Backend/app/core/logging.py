import logging
import logging.handlers
import warnings
from contextvars import ContextVar

from app.core.config import Settings

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(request_id)s | %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

ROOT_LOGGER_NAME = "webpilot"
ACTIVITY_LOGGER_NAME = "webpilot.activity"

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def _rotating_file_handler(settings: Settings, filename: str, level: int) -> logging.Handler:
    handler = logging.handlers.RotatingFileHandler(
        settings.log_dir / filename,
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
        encoding="utf-8",
    )
    handler.setLevel(level)
    return handler


def configure_logging(settings: Settings) -> None:
    root = logging.getLogger(ROOT_LOGGER_NAME)
    if root.handlers:
        return

    settings.log_dir.mkdir(parents=True, exist_ok=True)
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    warnings.filterwarnings("ignore", category=FutureWarning)

    formatter = logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT)
    request_filter = RequestIdFilter()

    console = logging.StreamHandler()
    console.setLevel(getattr(logging, settings.log_level, logging.INFO))

    handlers = [
        console,
        _rotating_file_handler(settings, "app.log", logging.DEBUG),
    ]
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.addFilter(request_filter)
        root.addHandler(handler)

    root.setLevel(logging.DEBUG)
    root.propagate = False

    activity = logging.getLogger(ACTIVITY_LOGGER_NAME)
    activity.setLevel(logging.INFO)
    activity.propagate = False
    activity_handler = _rotating_file_handler(settings, "activity.log", logging.INFO)
    activity_handler.setFormatter(formatter)
    activity_handler.addFilter(request_filter)
    activity.addHandler(activity_handler)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"{ROOT_LOGGER_NAME}.{name}")
