from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, require_roles
from app.demo_store import store
from app.schemas.model_schema import ClinicalGateRequest
from app.schemas.telemetry_schema import ReassignRequest

router = APIRouter(prefix="/governance", tags=["governance"])


@router.get("/overview")
def overview(
    time_range: str = Query(default="shift", pattern="^(shift|24h|7d)$"),
    progress: str = Query(default="All"),
    doctor: str = Query(default="All"),
    _user: CurrentUser = Depends(require_roles("hod")),
):
    snap = store.snapshot()
    cases = []
    for study in snap["studies"]:
        cases.append(
            {
                "id": study["id"],
                "patient": study["patient"],
                "progress": study.get("progress", "waiting"),
                "assignee": study.get("assignee", "Unassigned"),
                "sla_min": study["sla"] if study.get("progress") != "overdue" else -abs(4),
                "received": study["received"],
                "priority": study["status"],
                "window": "shift",
            }
        )
    for item in snap["ops"]["fallback_queue"]:
        cases.append(
            {
                "id": item["study_id"],
                "patient": "BN-6E11",
                "progress": "overdue",
                "assignee": item.get("assignee") or "Unassigned",
                "sla_min": -2,
                "received": "08:48",
                "priority": "Critical",
                "window": "shift",
            }
        )

    if progress != "All":
        cases = [c for c in cases if c["progress"] == progress]
    if doctor != "All":
        cases = [c for c in cases if c["assignee"] == doctor]

    counts = {"waiting": 0, "in_progress": 0, "overdue": 0}
    for c in cases:
        counts[c["progress"]] = counts.get(c["progress"], 0) + 1

    return {
        "time_range": time_range,
        "metrics": {
            **counts,
            "median_wait_min": 14,
            "suggestion_accepted_pct": 87,
            "staff_on_duty": sum(1 for r in snap["roster"] if r["status"]),
            "staff_total": len(snap["roster"]),
            "ai_active": snap["ops"]["ai_active"],
        },
        "cases": cases,
        "roster": snap["roster"],
        "policies": snap["assignment_policies"],
        "models": snap["models"],
    }


@router.get("/roster")
def roster(_user: CurrentUser = Depends(require_roles("hod"))):
    return store.snapshot()["roster"]


@router.post("/roster/{name}/toggle")
def toggle_roster(name: str, _user: CurrentUser = Depends(require_roles("hod"))):
    def write(state):
        for person in state["roster"]:
            if person["name"] == name:
                person["status"] = not person["status"]
                return person
        return None

    person = store.mutate(write)
    return person or {"message": "not found"}


@router.get("/policies")
def policies(_user: CurrentUser = Depends(require_roles("hod"))):
    return store.snapshot()["assignment_policies"]


@router.post("/reassign")
def reassign(body: ReassignRequest, user: CurrentUser = Depends(require_roles("hod"))):
    def write(state):
        for item in state["ops"]["fallback_queue"]:
            if item["study_id"] == body.study_id:
                item["assignee"] = body.assignee
        for study in state["studies"]:
            if study["id"] == body.study_id:
                study["assignee"] = body.assignee
                study["progress"] = "waiting"
        return {"study_id": body.study_id, "assignee": body.assignee}

    result = store.mutate(write)
    store.audit("REASSIGN", user.username, body.study_id)
    return result


@router.post("/clinical-gate")
def clinical_gate(body: ClinicalGateRequest, user: CurrentUser = Depends(require_roles("hod"))):
    def write(state):
        for model in state["models"]:
            if model["version"] == body.version:
                model["clinical_gate"] = "Approved" if body.approve else "Rejected"
                if body.approve and model["technical_gate"] == "Approved":
                    model["status"] = "Active"
                return model
        return None

    result = store.mutate(write)
    store.audit("CLINICAL_GATE", user.username, body.version)
    return result or {"message": "model not found"}
