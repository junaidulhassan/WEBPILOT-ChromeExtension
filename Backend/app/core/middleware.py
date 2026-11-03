import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import get_logger, request_id_var

logger = get_logger("http")

REQUEST_ID_HEADER = "X-Request-ID"


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex[:8]
        scope["request_id"] = request_id
        token = request_id_var.set(request_id)

        method = scope["method"]
        path = scope["path"]
        started = time.perf_counter()
        status_code = 500

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        logger.info(f"--> {method} {path}")
        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.exception(f"<!> {method} {path} raised after {duration_ms:.1f}ms")
            raise
        else:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.info(f"<-- {method} {path} {status_code} {duration_ms:.1f}ms")
        finally:
            request_id_var.reset(token)
