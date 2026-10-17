from typing import Any

AUTH_FAILURE_MESSAGE = (
    "\n\nThe selected model's API key was rejected by the provider. "
    "Check the key in Backend/.env and restart the server."
)
RATE_LIMIT_MESSAGE = "\n\nThe model provider is rate-limiting requests right now. Please wait a moment and try again."
MODEL_NOT_FOUND_MESSAGE = "\n\nThe provider doesn't recognise the selected model, or your key can't access it."
GENERIC_FAILURE_MESSAGE = "\n\nSorry, something went wrong while generating a response. Please try again."

_STATUS_MESSAGES = {
    401: AUTH_FAILURE_MESSAGE,
    403: AUTH_FAILURE_MESSAGE,
    404: MODEL_NOT_FOUND_MESSAGE,
    429: RATE_LIMIT_MESSAGE,
}


def describe_provider_error(error: BaseException) -> str:
    status: Any = getattr(error, "status_code", None) or getattr(getattr(error, "response", None), "status_code", None)
    return _STATUS_MESSAGES.get(status, GENERIC_FAILURE_MESSAGE)
