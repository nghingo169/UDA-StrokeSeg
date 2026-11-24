from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, require_roles
from app.demo_store import store
from app.schemas.telemetry_schema import SuspendRequest
from app.services import storage_service
from app.services.event_publisher import publish, recent

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/health")
def health():
    snap = store.snapshot()
    return {
        "status": "ok",
        "demo_mode": True,
        "ai_active": snap["ops"]["ai_active"],
        "components": snap["ops"]["health"],
        "processing": snap["processing"],
        "events": recent(5),
    }


@router.get("/dashboard")
def dashboard(_user: CurrentUser = Depends(require_roles("it", "hod"))):
    snap = store.snapshot()
    return {
        "health": snap["ops"]["health"],
        "ai_active": snap["ops"]["ai_active"],
        "suspend_reason": snap["ops"]["suspend_reason"],
        "fallback_queue": snap["ops"]["fallback_queue"],
        "storage": storage_service.storage_usage(),
        "quarantine_count": len(snap["quarantine"]),
        "events": recent(10),
    }


@router.post("/suspension")
def suspension(body: SuspendRequest, user: CurrentUser = Depends(require_roles("hod", "it"))):
    def write(state):
        if body.resume:
            state["ops"]["ai_active"] = True
            state["ops"]["suspend_reason"] = None
        else:
            state["ops"]["ai_active"] = False
            state["ops"]["suspend_reason"] = body.reason
        return {
            "ai_active": state["ops"]["ai_active"],
            "reason": state["ops"]["suspend_reason"],
        }

    result = store.mutate(write)
    topic = "InferenceResumed" if body.resume else "InferenceSuspended"
    publish(topic, {"actor": user.username, "reason": body.reason})
    store.audit(topic.upper(), user.username, "ai_service")
    return result
