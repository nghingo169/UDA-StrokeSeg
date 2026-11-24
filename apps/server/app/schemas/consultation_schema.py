from pydantic import BaseModel, Field


class CreateConsultationRequest(BaseModel):
    study_id: str
    trigger_reason: str = Field(min_length=3)


class AssignConsultationRequest(BaseModel):
    chairman_user_id: str
    participant_user_ids: list[str] = Field(default_factory=list)


class InviteMemberRequest(BaseModel):
    user_id: str


class DiscussionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ConclusionRequest(BaseModel):
    conclusion: str = Field(min_length=1)
    step_up_password: str = ""
    agreement: str = "Agree"
    agreement_note: str = ""


class AgreementRequest(BaseModel):
    agreement: str
    note: str = ""


class ConsensusRequest(BaseModel):
    notes: str = Field(min_length=1)
    agreement: str
    agreement_note: str = ""
    step_up_password: str = ""


class ZoomJoinPayload(BaseModel):
    meeting_number: str
    password: str
    signature: str
    sdk_key: str
    sdk_lib_version: str = "2.18.1"
    user_name: str
    user_email: str
    staff_id: str = ""
    role: int
    zak: str | None = None
    mock: bool = True
