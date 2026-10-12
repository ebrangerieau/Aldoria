from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app import errors
from app.config import get_settings
from app.routers import admin, admin_content, health, play

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    settings.check()
    # La documentation OpenAPI sera exposée uniquement côté admin (TRD §3.3).
    app = FastAPI(
        title="Aldoria API",
        version="0.2.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    errors.install(app)
    # Le paquet de session (≈ 200 Ko, surtout des SVG de formules) se compresse très bien.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(play.router, prefix=API_PREFIX)
    app.include_router(admin.router, prefix=API_PREFIX)
    app.include_router(admin_content.router, prefix=API_PREFIX)
    return app


app = create_app()
