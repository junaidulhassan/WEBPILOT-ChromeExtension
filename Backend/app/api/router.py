from fastapi import APIRouter

from app.api.routes import chat, embeddings, health, models, pages, tones

API_V1_PREFIX = "/api/v1"

api_router = APIRouter(prefix=API_V1_PREFIX)
api_router.include_router(pages.router)
api_router.include_router(chat.router)
api_router.include_router(models.router)
api_router.include_router(tones.router)
api_router.include_router(embeddings.router)

root_router = APIRouter()
root_router.include_router(health.router)
