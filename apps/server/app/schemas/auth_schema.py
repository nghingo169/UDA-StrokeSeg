from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(examples=["lena.morgan"])
    password: str = Field(examples=["Pass@123"])
    role: str | None = Field(default=None, examples=["radiologist"])


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: dict


class StepUpRequest(BaseModel):
    password: str


class MessageResponse(BaseModel):
    message: str
    detail: dict | None = None
