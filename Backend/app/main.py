from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router, root_router
from app.core.config import Settings, get_settings
from app.core.error_handlers import register_error_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import REQUEST_ID_HEADER, RequestContextMiddleware
from app.services.rag_service import RAGService

logger = get_logger("main")


def create_app(settings: Settings | None = None, rag_service: RAGService | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        service = rag_service or RAGService(settings)
        if rag_service is None:
            await run_in_threadpool(service.initialize)
        app.state.rag_service = service
        logger.info(f"{settings.app_name} v{__version__} started on {settings.host}:{settings.port}")
        yield
        logger.info("Backend shutting down")

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url=None,
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=settings.cors_origin_regex,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )

    register_error_handlers(app)
    app.include_router(root_router)
    app.include_router(api_router)
    return app


app = create_app()
