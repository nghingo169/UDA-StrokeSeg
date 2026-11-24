from fastapi import APIRouter, HTTPException

from app.demo_store import store

router = APIRouter(prefix="/series", tags=["series"])


@router.get("/{study_id}")
def list_series(study_id: str):
    snap = store.snapshot()
    exists = any(s["id"] == study_id for s in snap["studies"] + snap["signed_studies"])
    if not exists:
        raise HTTPException(status_code=404, detail="Study not found")
    return {
        "study_id": study_id,
        "series": [
            {"modality": "DWI", "slices": 34, "status": "ready"},
            {"modality": "ADC", "slices": 34, "status": "ready"},
            {"modality": "FLAIR", "slices": 34, "status": "ready"},
        ],
    }
