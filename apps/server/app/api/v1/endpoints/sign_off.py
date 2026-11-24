from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, require_roles
from app.schemas.clinical_schema import SignOffRequest
from app.services import sign_off_service

router = APIRouter(prefix="/sign-offs", tags=["sign-off"])


@router.post("/{study_id}")
def sign_off(
    study_id: str,
    body: SignOffRequest,
    user: CurrentUser = Depends(require_roles("radiologist")),
):
    return sign_off_service.sign_off(
        study_id,
        body.model_dump(),
        user.username,
        user.display_name,
    )
