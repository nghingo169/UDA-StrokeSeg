from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import CurrentUser, get_current_user

router = APIRouter(prefix="/dictation", tags=["dictation"])


class DictationRequest(BaseModel):
    language: str = "en-US"
    study_id: str | None = None


@router.post("/transcribe")
def transcribe(body: DictationRequest, user: CurrentUser = Depends(get_current_user)):
    # Dummy transcript for voice-to-text demo (no real ASR).
    text = (
        "Restricted diffusion in the left MCA territory with corresponding low ADC signal. "
        "No hemorrhagic component is identified."
    )
    return {
        "transcript": text,
        "language": body.language,
        "study_id": body.study_id,
        "by": user.username,
        "engine": "demo-stt",
    }
