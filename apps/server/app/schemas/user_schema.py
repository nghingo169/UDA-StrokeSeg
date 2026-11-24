from pydantic import BaseModel


class UserOut(BaseModel):
    id: str
    username: str
    display_name: str
    employee_id: str
    role: str
    initials: str
