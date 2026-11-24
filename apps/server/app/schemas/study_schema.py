from pydantic import BaseModel, Field


class StudyOut(BaseModel):
    id: str
    patient: str
    age: int
    sex: str
    onset: str
    received: str
    sla: int
    status: str
    case_state: str
    volume: float
    side: str
    territory: str
    nihss: int
    clusters: int
    missing_inputs: list[str]
    assignee: str | None = None
    progress: str | None = None
    suggestion_draft: str | None = None
    mask_version: str | None = None
    model_version: str | None = None


class NoteDraftRequest(BaseModel):
    note: str
    source: str = Field(default="manual", examples=["auto", "manual", "voice"])


class DispositionRequest(BaseModel):
    disposition: str
    note: str = ""
