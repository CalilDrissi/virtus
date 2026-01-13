from fastapi import APIRouter
from app.api.v1 import auth, users, organizations, models, subscriptions, data_sources, chat, billing, widget, admin

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(organizations.router)
api_router.include_router(models.router)
api_router.include_router(subscriptions.router)
api_router.include_router(data_sources.router)
api_router.include_router(chat.router)
api_router.include_router(billing.router)
api_router.include_router(widget.router)
api_router.include_router(admin.router)
