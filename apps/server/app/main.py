"""FastAPI entrypoint for local and Vercel deployments."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_router
from app.demo_store import store

app = FastAPI(
    title=settings.app_name,
    version="0.1.0-demo",
    description=(
        "UDA-StrokeSeg API Gateway. Configure UDA_DEMO_MODE=false for the "
        "PostgreSQL-backed HRM directory. Open `/docs` for Swagger."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
def root():
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "health": f"{settings.api_prefix}/operations/health",
        "mode": "demo" if settings.demo_mode else "database",
        "hint": "POST /api/v1/auth/login with {username, password, role}",
    }


@app.post(f"{settings.api_prefix}/demo/reset")
def reset_demo():
    state = store.reset()
    logger.info("Demo store reset")
    return {
        "message": "Demo data reset",
        "studies": len(state["studies"]),
        "signed": len(state["signed_studies"]),
    }


@app.on_event("startup")
def on_startup():
    logger.info("UDA-StrokeSeg demo API ready - Swagger at /docs")
