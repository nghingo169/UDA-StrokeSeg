from pydantic import BaseModel


class ClinicalGateRequest(BaseModel):
    version: str
    approve: bool = True
    note: str = ""
