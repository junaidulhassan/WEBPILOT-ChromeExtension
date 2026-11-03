import logging
from typing import Any

from app.core.logging import ACTIVITY_LOGGER_NAME

_activity_logger = logging.getLogger(ACTIVITY_LOGGER_NAME)


def record_activity(event: str, **fields: Any) -> None:
    parts = [event, *(f"{key}={value}" for key, value in fields.items())]
    _activity_logger.info(" ".join(parts))
