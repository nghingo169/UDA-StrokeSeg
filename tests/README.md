# UDA-StrokeSeg - Test Suite Tree

Cây thư mục kiểm thử cho hệ thống **UDA-StrokeSeg**, bám theo:

* `notes/UIUX/testing_uiux.md` - Test Plan & Test Cases (AUTH / RAD / PHY / CON / GOV / ADM / ALG / RBAC)
* `notes/UIUX/UIUX_ref_bugs.md` - Markdao 57 nhóm lỗi UX/UI (P0–P3)
* `notes/UIUX/UX_AUDIT_MARKDAO_57_UDA-StrokeSeg.md` - Audit đã chạy trên prototype SPA

---

## Cây hệ thống

```text
tests/
├── _templates/                 # Mẫu TC / bug / execution log
├── frontend/
│   ├── uiux/                   # Markdao 01–15 + flows + roles
│   └── spa/                    # Component / viewer / WS / STT
├── backend/
│   ├── api-gateway/            # FastAPI endpoints theo domain
│   ├── event-bus/              # Pub/Sub, SLA, circuit breaker, WS
│   └── workers/                # AI inference, volumetry, PDF
├── data/                       # ERD, PostgreSQL, MinIO, fixtures
├── security/                   # RBAC, JWT, idle lock, dual-gate
├── ai-ml/                      # Volumetry vàng, HITL, empty mask, UDA
├── integration/                # PACS, quarantine, E2E
├── performance/                # SLA 180s, CWV, API latency
└── Report/                    # Execution logs, UX audits, backlog
```

---

## Ánh xạ Test Case → thư mục

| Mã TC | Thư mục chính |
| :--- | :--- |
| TC-AUTH-01..03 | `frontend/uiux/flows/auth/` + `security/session-idle-lock/` + `backend/api-gateway/auth/` |
| TC-RAD-01..06 | `frontend/uiux/flows/radiologist/` + `frontend/spa/viewer-cornerstone/` |
| TC-PHY-01..02 | `frontend/uiux/flows/physician/` + `backend/api-gateway/treatment-plans/` |
| TC-CON-01..02 | `frontend/uiux/flowsConsultation/` + `backend/api-gatewayConsultation/` |
| TC-GOV-01..02 | `frontend/uiux/flows/governance-hod/` + `backend/event-bus/circuit-breaker/` |
| TC-ADM-01..03 | `frontend/uiux/flows/it-admin/` + `security/dual-gate/` + `backend/api-gateway/audit-logs/` |
| TC-ALG-VOLUMETRY | `ai-ml/volumetry/` |
| RBAC-01..07 | `security/rbac-matrix/` |
| Markdao 1–15 | `frontend/uiux/01-…` → `frontend/uiux/15-…` |

---

## Quy ước đặt tên file

* Spec kịch bản: `TC-<AREA>-<NN>.md` (ví dụ `TC-AUTH-01.md`)
* Checklist Markdao: `MK-<NN>-checklist.md` (ví dụ `MK-04-cta-buttons.md`)
* Bug từ audit: `BUG-P<priority>-<short-slug>.md` trong `Report/bug-backlog/`
* Báo cáo chạy: `Report/execution-logs/TR-YYYYMMDD-*.md`

Mẫu: xem `_templates/`.

---

## Ưu tiên (P0–P3)

Theo Markdao + clinical risk:

$$\text{Priority} = \text{Impact} \times \text{Frequency} \times \text{Risk}$$

* **P0** - chặn tác vụ lâm sàng / mất dữ liệu / trust (sign-off, draft leak, dual-gate)
* **P1** - ma sát cao trên critical path
* **P2** - consistency / friction
* **P3** - polish

---

## Liên kết tài liệu nguồn

* Test plan: [`notes/UIUX/testing_uiux.md`](../notes/UIUX/testing_uiux.md)
* Markdao ref: [`notes/UIUX/UIUX_ref_bugs.md`](../notes/UIUX/UIUX_ref_bugs.md)
* Audit: [`notes/UIUX/UX_AUDIT_MARKDAO_57_UDA-StrokeSeg.md`](../notes/UIUX/UX_AUDIT_MARKDAO_57_UDA-StrokeSeg.md)
* Execution log mẫu: [`notes/UIUX/TEST_EXECUTION_LOG_TR-20261109-UDA-CORE.md`](../notes/UIUX/TEST_EXECUTION_LOG_TR-20261109-UDA-CORE.md)

---

## Alignment with `notes/repo_structure.md`

Additional executable harness folders (scaffolded):

```text
tests/
├── clinical_golden/     # Algorithmic golden (volumetry / empty mask)
├── integration/         # PACS intake, SLA circuit breaker, mask conflict (pytest)
├── e2e/                 # Playwright SPA flows (RAD/PHY/CON/GOV/RBAC)
├── frontend/            # Existing UIUX + SPA specs (kept)
├── backend/             # Existing API / event-bus / workers specs (kept)
├── ai-ml/               # Existing ML case docs (kept)
├── data/ security/ performance/ Report/ ...
```

Prefer placing new **runnable** pytests/playwright code under `clinical_golden/`, `integration/`, `e2e/`. Keep domain docs/checklists under the existing FE/BE trees.
