"""Vercel entrypoint for the real FastAPI backend.

Vercel exposes this ASGI application under /api while the application keeps
its existing /api/v1 route contract for the web client and local Docker run.
"""

from pathlib import Path
import sys

SERVER_ROOT = Path(__file__).resolve().parents[1] / "apps" / "server"
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from app.main import app  # noqa: E402

