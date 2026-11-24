from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from app.services.zoom_meeting import authorization_url, credentials_present, exchange_code

router = APIRouter(prefix="/zoom", tags=["zoom"])


@router.get("/authorize")
def authorize_zoom():
    if not credentials_present():
        raise HTTPException(status_code=503, detail="Zoom client credentials are not configured")
    return RedirectResponse(authorization_url())


@router.get("/callback", response_class=HTMLResponse)
def zoom_callback(code: str = "", state: str = "", error: str = ""):
    if error:
        return HTMLResponse(f"<p>Zoom authorization was declined ({error}).</p>", status_code=400)
    try:
        exchange_code(code, state)
    except ValueError as exc:
        return HTMLResponse(f"<p>{exc}</p>", status_code=400)
    return HTMLResponse(
        "<p>Zoom connected. Create a new consultation in the app to open a live meeting.</p>"
    )
