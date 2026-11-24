from pydantic import BaseModel


class MaskRevisionRequest(BaseModel):
    tool: str = "Brush"
    revision_reason: str = ""
    volume_ml: float | None = None


class MaskOut(BaseModel):
    study_id: str
    version: str
    revised: bool
    volume_ml: float
    revision_reason: str | None = None
