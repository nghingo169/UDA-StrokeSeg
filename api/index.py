"""Vercel entrypoint for the real FastAPI backend.

Vercel exposes this ASGI application under /api while the application keeps
its existing /api/v1 route contract for the web client and local Docker run.
"""

from pathlib import Path
import sys

SERVER_ROOT = Path(__file__).resolve().parents[1] / "apps" / "server"
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from app.main import app as fastapi_app  # noqa: E402


class VercelPathAdapter:
    """Restore the public /api path after the file-function rewrite.

    The rewrite targets this Python function as /api/index.py/api/<path>.
    FastAPI routes are declared under /api/v1, so remove only the function
    filename prefix before handing the request to the application. If Vercel
    already preserves the original path, this adapter leaves it unchanged.
    """

    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if scope.get("type") in {"http", "websocket"}:
            path = scope.get("path", "")
            marker = "/api/index.py"
            if path.startswith(marker):
                normalized = path[len(marker) :] or "/"
                if not normalized.startswith("/"):
                    normalized = "/" + normalized
                scope = dict(scope)
                scope["path"] = normalized
                scope["raw_path"] = normalized.encode("utf-8")
        await self.application(scope, receive, send)


app = VercelPathAdapter(fastapi_app)

