class AppError(Exception):
    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidRequestError(AppError):
    status_code = 400
    code = "invalid_request"


class UnknownOptionError(AppError):
    status_code = 400
    code = "unknown_option"


class NoPageLoadedError(AppError):
    status_code = 409
    code = "no_page_loaded"

    def __init__(self, message: str = "No page loaded yet. Please open a webpage first.") -> None:
        super().__init__(message)


class ContentUnavailableError(AppError):
    status_code = 422
    code = "content_unavailable"


class SourceProcessingError(AppError):
    status_code = 500
    code = "source_processing_failed"


class ProviderUnavailableError(AppError):
    status_code = 503
    code = "provider_unavailable"


class RetrievalError(AppError):
    status_code = 502
    code = "retrieval_failed"
