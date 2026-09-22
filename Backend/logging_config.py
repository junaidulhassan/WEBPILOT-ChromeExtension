import logging
import logging.handlers
import os

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

FORMATTER = logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def _file_handler(filename, level):
    handler = logging.handlers.RotatingFileHandler(
        os.path.join(LOG_DIR, filename),
        maxBytes=2 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    handler.setLevel(level)
    handler.setFormatter(FORMATTER)
    return handler


def _build_app_logger():
    app_logger = logging.getLogger("webpilot")
    if app_logger.handlers:
        return app_logger

    app_logger.setLevel(logging.DEBUG)
    app_logger.propagate = False

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(FORMATTER)

    app_logger.addHandler(console_handler)
    app_logger.addHandler(_file_handler("app.log", logging.DEBUG))
    return app_logger


def _build_activity_logger():
    activity_logger = logging.getLogger("webpilot.activity")
    if activity_logger.handlers:
        return activity_logger

    activity_logger.setLevel(logging.INFO)
    activity_logger.propagate = False
    activity_logger.addHandler(_file_handler("activity.log", logging.INFO))
    return activity_logger


logger = _build_app_logger()
activity_logger = _build_activity_logger()
