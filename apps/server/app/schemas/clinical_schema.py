from pydantic import BaseModel, Field


class SignOffRequest(BaseModel):
    password: str = Field(examples=["Pass@123"])
    clinical_note: str
    disposition: str
    disposition_note: str = ""
    perceived_quality: str
    clinical_utility: int = Field(ge=1, le=5)
    attest: bool = True


class TreatmentPlanRequest(BaseModel):
    treatment: str
    note: str = ""


class ClinicalFeedbackRequest(BaseModel):
    note: str
    treatment: str | None = None
