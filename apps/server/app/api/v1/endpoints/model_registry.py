from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, require_roles
from app.demo_store import store
from app.schemas.model_schema import ClinicalGateRequest

router = APIRouter(prefix="/model-registry", tags=["model-registry"])


@router.get("")
def list_models(_user: CurrentUser = Depends(require_roles("it", "hod"))):
    return store.snapshot()["models"]


@router.post("/technical-gate")
def technical_gate(body: ClinicalGateRequest, user: CurrentUser = Depends(require_roles("it"))):
    def write(state):
        for model in state["models"]:
            if model["version"] == body.version:
                model["technical_gate"] = "Approved" if body.approve else "Rejected"
                return model
        return None

    result = store.mutate(write)
    store.audit("TECHNICAL_GATE", user.username, body.version)
    return result or {"message": "model not found"}
