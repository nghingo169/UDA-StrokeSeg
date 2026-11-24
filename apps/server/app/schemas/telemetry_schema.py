from pydantic import BaseModel


class SuspendRequest(BaseModel):
    reason: str
    resume: bool = False


class ReassignRequest(BaseModel):
    study_id: str
    assignee: str
