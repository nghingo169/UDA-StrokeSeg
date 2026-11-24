from fastapi import HTTPException, status

from app.demo_store import store
from app.services.event_publisher import publish


def get_mask(study_id: str) -> dict:
    masks = store.snapshot()["masks"]
    if study_id in masks:
        return masks[study_id]
    study = next((s for s in store.snapshot()["studies"] if s["id"] == study_id), None)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")
    return {
        "study_id": study_id,
        "version": study.get("mask_version", "System draft 01"),
        "revised": False,
        "volume_ml": study["volume"],
        "revision_reason": None,
    }


def revise_mask(study_id: str, tool: str, reason: str, volume_ml: float | None, actor: str) -> dict:
    def write(state):
        study = next((s for s in state["studies"] if s["id"] == study_id), None)
        if not study:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not found")
        new_volume = volume_ml if volume_ml is not None else round(study["volume"] + 0.7, 1)
        mask = {
            "study_id": study_id,
            "version": "Revision 02",
            "revised": True,
            "volume_ml": new_volume,
            "revision_reason": reason or f"Edited with {tool}",
            "tool": tool,
        }
        state["masks"][study_id] = mask
        study["volume"] = new_volume
        study["mask_version"] = "Revision 02"
        study["progress"] = "in_progress"
        return mask

    mask = store.mutate(write)
    publish("MaskRevised", {"study_id": study_id, "actor": actor})
    store.audit("MASK_REVISED", actor, study_id)
    return mask
