from fastapi import HTTPException, status

from app.core.security import verify_demo_password
from app.demo_store import store
from app.services.event_publisher import publish


def sign_off(study_id: str, payload: dict, actor: str, display_name: str) -> dict:
    verify_demo_password(payload["password"])
    if not payload.get("attest"):
        raise HTTPException(status_code=400, detail="Attestation required")
    if not payload.get("clinical_note", "").strip():
        raise HTTPException(status_code=400, detail="Clinical note required")
    if payload.get("disposition") == "not_used" and not payload.get("disposition_note", "").strip():
        raise HTTPException(status_code=400, detail="Reason required when suggestion is not used")

    def write(state):
        idx = next((i for i, s in enumerate(state["studies"]) if s["id"] == study_id), None)
        if idx is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not in worklist")
        study = state["studies"].pop(idx)
        signed = {
            **study,
            "case_state": "SignedOff",
            "signed": "now",
            "signer": display_name,
            "treatment": "Decision pending",
            "disposition": payload["disposition"],
            "disposition_note": payload.get("disposition_note", ""),
            "clinical_note": payload["clinical_note"],
            "perceived_quality": payload["perceived_quality"],
            "clinical_utility": payload["clinical_utility"],
            "report_version": "RPT-01",
        }
        state["signed_studies"].insert(0, signed)
        state["notes"].pop(study_id, None)
        return signed

    signed = store.mutate(write)
    publish("StudySignedOff", {"study_id": study_id, "actor": actor})
    store.audit("SIGN_OFF", actor, study_id)
    return signed
