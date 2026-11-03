from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppError
from app.core.logging import get_logger

logger = get_logger("errors")


def _error_response(request: Request, status_code: int, code: str, message: str) -> JSONResponse:
    request_id = request.scope.get("request_id", "-")
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "request_id": request_id}},
    )


def _describe_validation_error(exc: RequestValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Invalid request"
    first = errors[0]
    location = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    message = first.get("msg", "Invalid value")
    return f"{location}: {message}" if location else message


async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    logger.warning(f"{request.method} {request.url.path} rejected: {exc.code} - {exc.message}")
    return _error_response(request, exc.status_code, exc.code, exc.message)


async def _handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    message = _describe_validation_error(exc)
    logger.warning(f"{request.method} {request.url.path} validation failed: {message}")
    return _error_response(request, 422, "validation_error", message)


async def _handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    code = "not_found" if exc.status_code == 404 else "http_error"
    return _error_response(request, exc.status_code, code, message)


async def _handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        f"{request.method} {request.url.path} crashed",
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return _error_response(request, 500, "internal_error", "Something went wrong on the server.")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _handle_app_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_exception)
    app.add_exception_handler(Exception, _handle_unexpected_error)
