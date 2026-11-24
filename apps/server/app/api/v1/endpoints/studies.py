from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, get_current_user, get_optional_user
from app.schemas.study_schema import DispositionRequest, NoteDraftRequest
from app.services import study_service

router = APIRouter(prefix="/studies", tags=["studies"])


@router.get("")
def list_studies(
    priority: str | None = Query(default=None),
    q: str | None = Query(default=None),
    _user: CurrentUser | None = Depends(get_optional_user),
):
    return study_service.list_studies(priority=priority, query=q)


@router.get("/signed")
def list_signed(_user: CurrentUser | None = Depends(get_optional_user)):
    return study_service.list_signed()


@router.get("/{study_id}")
def get_study(study_id: str, _user: CurrentUser | None = Depends(get_optional_user)):
    return study_service.get_study(study_id)


@router.put("/{study_id}/notes")
def save_note(
    study_id: str,
    body: NoteDraftRequest,
    user: CurrentUser = Depends(get_current_user),
):
    return study_service.save_note(study_id, body.note, body.source, user.username)


@router.put("/{study_id}/disposition")
def save_disposition(
    study_id: str,
    body: DispositionRequest,
    user: CurrentUser = Depends(get_current_user),
):
    return study_service.save_disposition(study_id, body.disposition, body.note, user.username)
