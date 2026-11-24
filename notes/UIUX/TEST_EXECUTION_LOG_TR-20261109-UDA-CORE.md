# Test Execution Run Report

* **Mã đợt kiểm thử:** TR-20261109-UDA-CORE
* **Phiên bản phần mềm:** UDA-StrokeSeg frontend SPA (Vite/React prototype on `localhost:8443`)
* **Người thực hiện:** Cursor Agent (browser automation + CDP + source cross-check)
* **Ngày thực hiện:** 09/11/2026
* **Phạm vi:** UI/UX flows theo `notes/UIUX/testing_uiux.md`
* **Giới hạn môi trường:** Frontend-only prototype - **không** có FastAPI JWT, PostgreSQL, Redis/WS, PACS, MinIO, AI worker. Kết quả backend/API ghi **BLOCKED** hoặc **PASS-UI** (chỉ xác minh hành vi giao diện/mock).

## Kết quả tổng hợp

| Kết quả | Số lượng |
| :--- | ---: |
| PASS-UI | 14 |
| PARTIAL | 4 |
| BLOCKED (cần backend) | 5 + RBAC API matrix |
| FAIL | 0 |

---

## Bảng kết quả theo template §5

| Mã Test Case | Phân hệ kiểm thử | Kết quả | Thời gian phản hồi | Ghi chú & bằng chứng |
| :--- | :--- | :---: | :---: | :--- |
| **TC-AUTH-01** | Gateway Authentication | **PARTIAL** | ~instant UI | Role redirect UI đúng: Radiologist → worklist, Physician → Released cases, HoD → Clinical overview, IT → System operations. Demo password `Pass@123`. **Không** sinh JWT 900s / AuditLog LOGIN (backend BLOCKED). |
| **TC-AUTH-02** | Idle Session Timeout | **PARTIAL** | Manual lock OK | Nút **Lock session now** → overlay khóa, che PHI, ô password unlock. Idle 15 phút / force-logout sau +5 phút **không đo full wait** trong phiên này (timer có trong code). Wrong password unlock **không** thấy message lỗi rõ trên UI. |
| **TC-AUTH-03** | Emergency Bypass | **BLOCKED / code-only** | - | Không chạy idle 15 phút trên ca emergency. Source có keep-alive khi emergency/SLA - cần test thời gian thực. |
| **TC-RAD-01** | Worklist SLA Timer | **PASS-UI** | Realtime client | Emergency worklist: badge cấp cứu, countdown 180s đổi màu (green/amber/red), trạng thái processing → AwaitingReview mock. **Không** WebSocket từ worker thật. |
| **TC-RAD-02** | Synchronized Viewer | **PASS-UI** | Client | Workspace đa viewport DWI/ADC/FLAIR, slice sync, Space toggle mask, tọa độ vật lý hiển thị. Cornerstone3D thật không gắn - mock viewer. |
| **TC-RAD-03** | HITL Mask Revision | **PASS-UI** | Client | Brush/Eraser, bắt buộc lý do revision, cập nhật volume/revision badge trên UI. Không POST `/mask-revisions` / DB ParentMaskID. |
| **TC-RAD-04** | Empty Mask Warning | **PASS-UI** | Client | Ca empty mask: cảnh báo bắt buộc đọc lát cắt, volume 0.000 mL, vẫn cho Brush. Không auto-sign-off âm tính. |
| **TC-RAD-05** | Voice Dictation (STT) | **PARTIAL** | Client | Composer type + mic control / auto-fill metrics có trên UI. **Không** Web Audio STT thật - không verify câu đọc mẫu. |
| **TC-RAD-06** | Sign-off & Lock Case | **PASS-UI** | Client | Feedback AI + step-up password modal + trạng thái SignedOff / khóa tool sau ký (mock). Không PDF storage / event bus. |
| **TC-PHY-01** | Draft Access Guardrail | **PASS-UI** | Client | Physician chỉ thấy **Released cases**; banner read-only / không lộ unsigned draft. Deep-link API 403 không kiểm được. |
| **TC-PHY-02** | Treatment Decision Plan | **PASS-UI** | Client | Eligibility, r-tPA/EVT/Thrombolysis, Save plan, Signed PDF action trên UI. Persist ClinicalFeedback BLOCKED. |
| **TC-CON-01** | Multi-Doctor Canvas | **PARTIAL** | Client | Consultation session UI, members/roles, canvas controls. **Không** multi-user WebSocket cursor sync. |
| **TC-CON-02** | Consensus Sign-off | **PASS-UI** | Client | Vote Agree/Disagree, consensus notes, chair sign-off step-up trên UI. Persist FINALIZED BLOCKED. |
| **TC-GOV-01** | 180s SLA Reassignment | **PASS-UI** | Client | Emergency manual fallback AIS-240913-091 (>180s), select roster, **Reassign now** (disabled đến khi chọn bác sĩ). WS push BLOCKED. |
| **TC-GOV-02** | Circuit Breaker Suspend | **PASS-UI** | Client | **Pause AI** → modal lý do bắt buộc → **Confirm pause** → nút đổi **Resume AI** + banner manual fallback. API `POST /operations/suspension` BLOCKED. |
| **TC-ADM-01** | Dual-Gate Deployment | **PASS-UI** | Client | Model registry: **Activate model** `disabled` khi clinical pending / Activation blocked. Dual-gate API 400 BLOCKED. |
| **TC-ADM-02** | Quarantine Log Manager | **PASS-UI** | Client | Quarantine log: Missing FLAIR, **Request rescan**, mã `0xC000`. PACS C-STORE thật BLOCKED. |
| **TC-ADM-03** | Immutable Audit Trail | **PASS-UI** | Client | Audit log: Integrity verified, view JSON, copy “cannot be edited”. DELETE 405 API BLOCKED. |
| **TC-ALG-01** | Native Volumetry Test | **BLOCKED** | - | Không chạy synthetic 128³ matrix / voxel math trên worker. UI volume display không thay cho nghiệm thu thuật toán. |

---

## Ma trận RBAC (§2) - kết quả UI

| Mã | Kết quả | Ghi chú |
| :--- | :---: | :--- |
| **RBAC-01** | PASS-UI | Radiologist thấy emergency worklist; role khác không vào nav CĐHA trừ khi switch + reauth. |
| **RBAC-02** | PASS-UI | Mask tools chỉ trên workspace Radiologist. |
| **RBAC-03** | PASS-UI | Sign-off chỉ flow Radiologist (step-up). Không verify HTTP 403. |
| **RBAC-04** | PASS-UI | Treatment plan trên Physician; role khác không có nav tương đương. |
| **RBAC-05** | PASS-UI | Pause AI trên HoD overview. |
| **RBAC-06** | PASS-UI | Activate model disabled khi thiếu clinical gate. |
| **RBAC-07** | PASS-UI | Audit log chỉ trong IT nav. API 403 BLOCKED. |

---

## Accessibility smoke (bổ sung UIUX)

| Check | Kết quả | Bằng chứng |
| :--- | :---: | :--- |
| Skip to main content | PASS | Link `Skip to main content` có trong DOM |
| Landmark main / nav | PASS | `main` + role-specific `navigation` |
| Live region / toast | PASS | `[role=status]` / `aria-live` |
| Dialog semantics | PASS | Suspend/Pause modal `role=dialog` + Escape |
| Role re-auth gate | PASS | Switch role yêu cầu password trước khi đổi workspace |

---

## Chi tiết phiên browser

* **URL:** `http://localhost:8443/`
* **Công cụ:** cursor-ide-browser (snapshot, fill, click) + CDP `Runtime.evaluate`
* **Actors đã chạy:** Radiologist → Physician (reauth) → HoD (Pause AI) → IT (Ops / Model registry / Quarantine / Audit) → Session lock/unlock
* **Demo credential:** `Pass@123`

### Lệnh quan sát chính

1. IT nav async: Model registry (`Activate model` disabled + Activation blocked) → Quarantine (FLAIR + 0xC000 + Request rescan) → Audit (immutable + JSON).
2. HoD: Clinical overview fallback queue + Pause AI confirm với reason bắt buộc → Resume AI.
3. Physician: Released cases only + treatment/PDF controls + consultation entry.
4. Lock session → unlock với `Pass@123`.

---

## Hạng mục BLOCKED cần môi trường tích hợp

1. JWT claims, TTL 900s, AuditLog LOGIN/IP/UA  
2. Idle 15 phút + logout +5 phút (đo thời gian thật) + emergency keep-alive banner  
3. WebSocket SLA / multi-user consultation cursor sync  
4. PostgreSQL ERD writes, append-only DELETE 405, dual-gate 400  
5. PACS DICOM 0xC000 round-trip, MinIO signed PDF, AI worker volumetry TC-ALG-01  
6. Real microphone STT  

---

## Kết luận

Prototype UIUX **đạt mức PASS-UI** cho gần hết workflow sitemap (AUTH redirect mock, RAD, PHY, CON, GOV, ADM). Không có FAIL giao diện trong phạm vi đã chạy. Các tiêu chí state-machine/API/event/algorithm trong plan **chưa thể PASS đầy đủ** cho đến khi gắn backend theo §1.2 của `testing_uiux.md`.

**Khuyến nghị bước tiếp:** gắn API gateway + chạy lại cùng mã TR với cột kết quả backend (Pass/Fail thật), ưu tiên AUTH-02 full idle, RBAC HTTP 403, ADM dual-gate, ALG volumetry.
