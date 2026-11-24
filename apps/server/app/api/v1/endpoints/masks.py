from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, get_current_user, get_optional_user
from app.schemas.mask_schema import MaskRevisionRequest
from app.services import mask_service

router = APIRouter(prefix="/masks", tags=["masks"])


@router.get("/{study_id}")
def get_mask(study_id: str, _user: CurrentUser | None = Depends(get_optional_user)):
    return mask_service.get_mask(study_id)


@router.post("/{study_id}/revisions")
def revise(
    study_id: str,
    body: MaskRevisionRequest,
    user: CurrentUser = Depends(get_current_user),
):
    return mask_service.revise_mask(
        study_id, body.tool, body.revision_reason, body.volume_ml, user.username
    )
