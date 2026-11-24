# UDA-StrokeSeg Demo API

In-memory FastAPI backend for lecturer full-flow demos (no PostgreSQL / Redis / GPU required).

## Quick start

```bash
cd apps/server
python -m venv .venv

# Windows (cmd):
.venv\Scripts\activate.bat
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

python -m pip install -r requirements.txt
# Prefer module form so you always use the venv interpreter:
python -m uvicorn app.main:app --reload --port 8000
```

> Note: the target is `app.main:app` (**one** colon). `app.main::app` will fail.

Open:

- Swagger UI: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/v1/operations/health

## Demo credentials

| Role | Username | Password |
| :--- | :--- | :--- |
| Radiologist | `lena.morgan` | `Pass@123` |
| Radiologist | `priya.shah` | `Pass@123` |
| Stroke Physician | `maya.harris` | `Pass@123` |
| Head of Department | `thomas.nguyen` | `Pass@123` |
| IT Admin | `alex.nguyen` | `Pass@123` |

Login example:

```http
POST /api/v1/auth/login
{
  "username": "lena.morgan",
  "password": "Pass@123",
  "role": "radiologist"
}
```

Use returned `access_token` as `Authorization: Bearer <token>`.

## Suggested lecturer walkthrough

1. **Login** as radiologist → `GET /studies`
2. Open study → `GET /studies/AIS-240913-084`
3. Auto-save note → `PUT /studies/{id}/notes`
4. Disposition + note → `PUT /studies/{id}/disposition`
5. Mask revise → `POST /masks/{id}/revisions`
6. Sign-off → `POST /sign-offs/{id}` (password `Pass@123`)
7. Physician feedback → login `maya.harris` → `POST /feedback/{id}/clinical`
8. HoD oversight → login `thomas.nguyen` → `GET /governance/overview`
9. Pause automated analysis → `POST /operations/suspension`
10. Reset seed anytime → `POST /api/v1/demo/reset`

## Consultation + Zoom Meeting SDK

Lifecycle under `/api/v1/consultation`:

1. `POST Consultation` - radiologist requests a room. The standing chairman (physician) may also open one, but only for a study whose status is `Critical`. Creates a Zoom meeting (password, waiting room, camera and mic off) and stores `meeting_id`, password, and host ZAK server-side. Status `PENDING_ASSIGNMENT`. Meeting numbers that start with `900` are demo rooms (`zoom_mock: true`) and stay that way.
2. `POST Consultation/{id}/assign` - Head of Department (or a user flagged `consultation_delegate`). The standing chairman may assign themselves on a Critical study they just opened. Sets the Chairman and participants, then writes in-app notices plus an email log.
3. `POST Consultation/{id}/start|join` - Chairman receives SDK signature role `1` and a ZAK. Participants receive role `0` and their staff id in the display name. Attendance is appended for the audit log.
4. `POST Consultation/{id}/end` or `POST Consultation/zoom/webhook` with `meeting.ended` - status `AWAITING_CONCLUSION`.
5. `POST Consultation/{id}/conclusion` - Chairman password check, digital signature, status `COMPLETED`, chart addendum.

`POST Consultation/{id}/consensus` is the same closure as `/conclusion`.
`WS Consultation/{id}/ws?token=...` syncs the shared viewport.

Without Zoom credentials the API returns **mock** meeting numbers, ZAK values, and SDK JWTs (`zoom_mock: true`). Optional env (prefix `UDA_`):

```env
UDA_ZOOM_ACCOUNT_ID=
UDA_ZOOM_CLIENT_ID=
UDA_ZOOM_CLIENT_SECRET=
UDA_ZOOM_SDK_KEY=
UDA_ZOOM_SDK_SECRET=
UDA_ZOOM_REDIRECT_URI=https://<your-ngrok-host>/api/v1/zoom/callback
UDA_ZOOM_HOST_USER_ID=me
UDA_ZOOM_SDK_VERSION=2.18.1
UDA_ZOOM_WEBHOOK_SECRET=
```

Put the real values in `apps/server/.env` only. A General app uses one Client ID and Client Secret for both REST and the Meeting SDK JWT, so `UDA_ZOOM_SDK_KEY` and `UDA_ZOOM_SDK_SECRET` can stay empty. Leave `UDA_ZOOM_ACCOUNT_ID` empty unless the app is Server-to-Server OAuth. After the keys are set, open `http://127.0.0.1:8000/api/v1/zoom/authorize` once so Zoom can store a refresh token outside the repo. The redirect URL in the Zoom app must match `UDA_ZOOM_REDIRECT_URI` exactly. Rooms created before that grant keep their `900…` meeting numbers and stay in demo mode; create a new consultation to get a live meeting.

When `UDA_ZOOM_WEBHOOK_SECRET` is set, `meeting.ended` must send header `x-uda-webhook-token` equal to the hex HMAC-SHA256 of the raw body.

Frontend Client View uses `@zoom/meetingsdk` in `apps/web` (`npm install @zoom/meetingsdk -w @uda-strokeseg/web` from the repo root). While `zoom_mock` is true, the room shows the demo video strip. The Chairman join payload includes `zak` for `ZoomMtg.join`.

## Frontend proxy

Vite proxies `/api` (including WebSocket) → `http://127.0.0.1:8000` so the SPA can call the same paths.
