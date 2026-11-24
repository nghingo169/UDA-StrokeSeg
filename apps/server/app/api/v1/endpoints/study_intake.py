from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import CurrentUser, require_roles
from app.services import study_intake_service

router = APIRouter(prefix="/study-intake", tags=["study-intake"])


class IntakeBody(BaseModel):
    accession: str
    series: list[str]


@router.post("")
def intake(body: IntakeBody, user: CurrentUser = Depends(require_roles("it", "radiologist"))):
    return study_intake_service.intake_study(body.accession, body.series, user.username)
