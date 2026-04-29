from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.generations import router as generation_router
from app.api.v1.me import router as me_router
from app.api.v1.settings import router as settings_router
from app.api.v1.templates import router as template_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(generation_router)
api_router.include_router(me_router)
api_router.include_router(settings_router)
api_router.include_router(template_router)
api_router.include_router(admin_router)
