"""Aggregate APIRouter v1."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit,
    auth,
    consultations,
    dictation,
    feedback,
    governance,
    masks,
    model_registry,
    notifications,
    operations,
    pacs,
    quarantine,
    reports,
    series,
    sign_off,
    studies,
    study_intake,
    users,
    zoom_oauth,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(studies.router)
api_router.include_router(series.router)
api_router.include_router(study_intake.router)
api_router.include_router(masks.router)
api_router.include_router(sign_off.router)
api_router.include_router(reports.router)
api_router.include_router(consultations.router)
api_router.include_router(feedback.router)
api_router.include_router(governance.router)
api_router.include_router(operations.router)
api_router.include_router(model_registry.router)
api_router.include_router(pacs.router)
api_router.include_router(quarantine.router)
api_router.include_router(audit.router)
api_router.include_router(notifications.router)
api_router.include_router(dictation.router)
api_router.include_router(zoom_oauth.router)
