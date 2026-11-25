from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import CurrentUser, require_roles
from app.db import state as store
from app.schemas.clinical_schema import ClinicalFeedbackRequest, TreatmentPlanRequest

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/{study_id}/treatment")
def save_treatment(
    study_id: str,
    body: TreatmentPlanRequest,
    user: CurrentUser = Depends(require_roles("physician")),
):
    def write(state):
        study = next((s for s in state["signed_studies"] if s["id"] == study_id), None)
        if not study:
            raise HTTPException(status_code=404, detail="Signed study not found")
        study["treatment"] = body.treatment
        state["feedback"][study_id] = {
            **state["feedback"].get(study_id, {}),
            "treatment": body.treatment,
            "treatment_note": body.note,
            "by": user.username,
        }
        return state["feedback"][study_id]

    result = store.mutate(write)
    store.audit("TREATMENT_PLAN", user.username, study_id)
    return result


@router.post("/{study_id}/clinical")
def save_clinical_feedback(
    study_id: str,
    body: ClinicalFeedbackRequest,
    user: CurrentUser = Depends(require_roles("physician")),
):
    def write(state):
        study = next((s for s in state["signed_studies"] if s["id"] == study_id), None)
        if not study:
            raise HTTPException(status_code=404, detail="Signed study not found")
        if body.treatment:
            study["treatment"] = body.treatment
        state["feedback"][study_id] = {
            **state["feedback"].get(study_id, {}),
            "clinical_note": body.note,
            "treatment": body.treatment or study.get("treatment"),
            "by": user.username,
        }
        return state["feedback"][study_id]

    result = store.mutate(write)
    store.audit("CLINICAL_FEEDBACK", user.username, study_id)
    return result


@router.get("/{study_id}")
def get_feedback(study_id: str, user: CurrentUser = Depends(require_roles("physician", "hod"))):
    return store.snapshot()["feedback"].get(study_id) or {}
