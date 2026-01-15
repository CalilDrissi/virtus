from fastapi import APIRouter
from app.api.v1 import auth, users, organizations, models, subscriptions, data_sources, chat, billing, widget, admin, teams, roles, categories

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(organizations.router)
api_router.include_router(models.router)
api_router.include_router(subscriptions.router)
api_router.include_router(data_sources.router)  # Model data sources: /models/{id}/data-sources
api_router.include_router(data_sources.rag_router)  # RAG query: /data-sources/query
api_router.include_router(chat.router)
api_router.include_router(billing.router)
api_router.include_router(widget.router)
api_router.include_router(admin.router)
api_router.include_router(teams.router)
api_router.include_router(roles.router)
api_router.include_router(categories.router)
