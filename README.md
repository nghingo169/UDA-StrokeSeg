# UDA-StrokeSeg

Modular monorepo for acute ischemic stroke MRI decision support (HITL / HOTL, SLA 180s, dual-gate model activation).

Blueprint: [`notes/repo_structure.md`](notes/repo_structure.md)

## Apps

| Path | Role |
| :--- | :--- |
| `apps/web` | React 19 + Vite 8 + Tailwind v4 SPA (role workspaces) |
| `apps/server` | FastAPI demo API Gateway (in-memory) |
| `apps/event_bus` | Pub/Sub workers, SLA circuit breaker (scaffold) |
| `apps/ai_pipeline` | Preprocess → inference → volumetry (scaffold) |
| `packages/common-types` | Shared FE↔BE enums/DTOs (codegen target) |
| `packages/dicom-utils` | Shared DICOM helpers |
| `ops/` | Docker, k8s, PACS simulator, runbooks |
| `tests/` | FE/BE UIUX suites + clinical_golden / integration / e2e |

---

## Prerequisites

- Node.js **≥ 20**
- Package manager: **npm** (Node 22). Cài dependency từ root để npm workspaces liên kết `apps/web` và `packages/*`.
- Python **≥ 3.11** (for `apps/server`)

---

## Quick start (2 terminals)

### 1) Demo API - `http://127.0.0.1:8000`

```bash
cd apps/server
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Windows cmd
# .venv\Scripts\activate.bat
# macOS / Linux
# source .venv/bin/activate

python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

From repo root (if `dev:api` uses system Python with deps installed):

```bash
npm run dev:api
```

| URL | Purpose |
| :--- | :--- |
| http://127.0.0.1:8000/docs | Swagger |
| http://127.0.0.1:8000/api/v1/operations/health | Health |
| `POST /api/v1/demo/reset` | Reset in-memory seed |

### 2) Web SPA - `http://localhost:8443`

```bash
# From repo root
npm install
npm run dev
```

Vite proxies `/api` (+ WebSocket) → `http://127.0.0.1:8000`.

| URL | Role demo |
| :--- | :--- |
| http://localhost:8443/?role=radiologist | Radiologist worklist |
| http://localhost:8443/?role=physician | Stroke physician |
| http://localhost:8443/?role=hod | Head of Department |
| http://localhost:8443/?role=it | IT Admin |

---

## Deploy frontend to Vercel

The existing Vercel project now hosts both the Vite SPA and the FastAPI API as a Python Function. PostgreSQL still has to be an external managed database because Vercel does not provide a persistent local database volume. Kafka is optional for this demo deployment; the current event publisher records request events without requiring a broker.

The existing Vercel project is already connected to this repository and deploys from `main`. Keep that project; the committed [vercel.json](./vercel.json) uses `npm ci`, runs `npm run build`, and publishes `apps/web/dist` when the Vercel Root Directory is the repository root.

For the real PostgreSQL-backed backend, configure these Vercel environment variables for **Production**:

```env
UDA_DEMO_MODE=false
UDA_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
UDA_CORS_ORIGINS=["https://uda-strokeseg.vercel.app"]
UDA_DEMO_PASSWORD=Pass@123
VITE_DEMO_MODE=false
```

Leave `VITE_API_BASE_URL` empty so the browser calls the same Vercel origin at `/api/v1`. If the API is later moved to another host, set:

```env
VITE_DEMO_MODE=true
VITE_DEMO_PASSWORD=Pass@123
VITE_API_BASE_URL=https://your-api.example.com
```

`VITE_API_BASE_URL` is the backend origin only; do not append `/api/v1`. Configure the backend CORS allow-list to include the Vercel domain.

Before the first real deployment, create the PostgreSQL schema and run the synthetic seed from [005_seed_demo_data.sql](./ops/docker/postgres/init/005_seed_demo_data.sql) against the managed database. The Vercel Function is stateless and cannot run the local Docker Compose PostgreSQL volume.

Production is deployed automatically by the existing Vercel Git Integration when `main` is updated. The GitHub Actions [cd-production.yml](./.github/workflows/cd-production.yml) workflow is manual-only, for cases where you explicitly want a Vercel CLI deploy; it requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. Preview deployment is manual through [cd-staging.yml](./.github/workflows/cd-staging.yml).

---

## Command cheat sheet

### Root (`package.json`)

| Command | What it does |
| :--- | :--- |
| `npm install` | Install monorepo deps |
| `npm run dev` | Start Vite web (`apps/web`, port **8443**) |
| `npm run dev:api` | Start FastAPI (`apps/server`, port **8000**) |
| `npm run build` | Production build of web |
| `npm run preview` | Preview production build |
| `npm run format` | Format web with oxfmt |
| `npm run typecheck` | `tsc --noEmit` for web |
| `npm run gen:types` | TODO: OpenAPI → `packages/common-types` |

### Web (`apps/web`)

| Command | What it does |
| :--- | :--- |
| `npm run dev -w @uda-strokeseg/web` | Same as `npm run dev` |
| `npx vite --port 8443` | Start Vite without the workspace script |
| `npx tsc --noEmit` | Typecheck |
| `npm run build -w @uda-strokeseg/web` | Build |
| `npm install @zoom/meetingsdk -w @uda-strokeseg/web` | Zoom Meeting SDK Client View |

Env (Vite):

```bash
# apps/web/.env.development
VITE_DEMO_MODE=true
VITE_DEMO_PASSWORD=Pass@123

# apps/web/.env.production
VITE_DEMO_MODE=false
```

### Server (`apps/server`)

| Command | What it does |
| :--- | :--- |
| `python -m venv .venv` | Create venv |
| `python -m pip install -r requirements.txt` | Install API deps |
| `python -m uvicorn app.main:app --reload --port 8000` | Run API (note: **one** colon) |
| `python -m pytest ../../tests/backend/api-gatewayConsultation -q` | Consultation lifecycle test (needs `pytest` + `httpx` in venv) |

Optional Zoom (prefix `UDA_`):

```env
UDA_ZOOM_ACCOUNT_ID=
UDA_ZOOM_CLIENT_ID=
UDA_ZOOM_CLIENT_SECRET=
UDA_ZOOM_SDK_KEY=
UDA_ZOOM_SDK_SECRET=
UDA_ZOOM_REDIRECT_URI=http://127.0.0.1:8000/api/v1/zoom/callback
UDA_ZOOM_HOST_USER_ID=me
```

Real values belong in `apps/server/.env` only. A General app reuses its Client ID and Client Secret as the SDK key pair, so the SDK lines can stay empty. Without a completed Zoom grant the API still returns `zoom_mock: true`.

### Tests

```bash
# Backend consultation lifecycle (from apps/server, venv active)
python -m pip install httpx pytest
set PYTHONPATH=.
python -m pytest ../../tests/backend/api-gatewayConsultation/test_consultation_lifecycle.py -q

# Playwright e2e (when configured)
# npx playwright test tests/e2eConsultation_session.spec.ts
```

### Make / misc

```bash
make gen-types      # TODO: OpenAPI → packages/common-types
make fetch-weights  # AI weights from Model Registry (not committed)
```

---

## Demo credentials

Password for all demo users: **`Pass@123`** (only when `VITE_DEMO_MODE=true`).

| Role | Username |
| :--- | :--- |
| Radiologist | `lena.morgan` |
| Radiologist | `priya.shah` |
| Stroke Physician | `maya.harris` |
| Head of Department | `thomas.nguyen` |
| IT Admin | `alex.nguyen` |

Login API:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "lena.morgan",
  "password": "Pass@123",
  "role": "radiologist"
}
```

---

## Consultation demo (Zoom Meeting SDK)

1. Start API + web (commands above).
2. Sign in as **Stroke Physician** → sidebar **Consultation** → **Create consultation room**. The room waits for assignment. Zoom is created with a password, waiting room, and camera/mic off. The host token stays on the server.
3. Switch to **HoD** → **Waiting for chairman assignment** → choose a Chairman and participants. Each person gets an in-app notice.
4. Open the room as the Chairman → **Start**. Other doctors **Join**. The Chairman receives the host token; everyone else is labeled with their staff id.
5. **End meeting** (or a Zoom `meeting.ended` webhook) → **Sign conclusion**.

Details: [`apps/server/README.md`](apps/server/README.md)

---

## Notes

- Prototype UI still centered in `apps/web/src/App.tsx` (feature stubs under `features/*`).
- Specs / ERD / sitemap / UIUX plans: `notes/`.
