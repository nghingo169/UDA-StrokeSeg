# UDA-StrokeSeg: Cấu Trúc Thư Mục Toàn Diện Dự Án (Production-Ready Repository Structure)

> **Tài liệu:** Đặc tả Kiến trúc Cây Thư mục & Tổ chức Mã nguồn (Repository Blueprint)  
> **Dự án:** UDA-StrokeSeg - Hệ thống Hỗ trợ Chẩn đoán Đột quỵ Nhồi máu não Cấp tính trên Ảnh MRI Đa chuỗi xung Đa trung tâm (UDA nnU-Net)  
> **Chuẩn kiến trúc:** Modular Monorepo kết hợp Event-Driven Services  
> **Nguồn ánh xạ bắt buộc:**  
> 1. `[UDA-StrokeSeg] System architecture.png` → phân hệ `apps/*`, `ops/*`, storage  
> 2. `[UDA-StrokeSeg] Sitemap design.png` (+ `Sitemap.png`) → `apps/web/src/features/*` & routes  
> 3. `[UDA-StrokeSeg] ERD.png` → `apps/server/app/models/*` & schemas  

---

## 0. BẢNG ÁNH XẠ DIAGRAM → THƯ MỤC (TRACEABILITY)

| Khối trên diagram | Thư mục / module trong repo |
| :--- | :--- |
| **Architecture - Web UI (Role-based SPA)** | `apps/web` |
| **Architecture - API Gateway + Auth & RBAC** | `apps/server/app/api`, `apps/server/app/core` |
| **Architecture - Worklist & Review / Mask Review & Revision / Speech-to-Text / Report & Export** | `apps/web/src/features/radiologist/*`, `apps/server` services tương ứng |
| **Architecture - Consultation & Panel Review** | `apps/web/src/features/consultation/*` |
| **Architecture - Ops Dashboard** | `apps/web/src/features/admin/OpsDashboard*` (IT Admin) |
| **Architecture - Study Intake & Validation** | `apps/server/.../study_intake*`, `apps/event_bus/workers/intake_validation_worker.py` |
| **Architecture - Event Bus / Queue / Circuit Breaker (180s)** | `apps/event_bus` |
| **Architecture - AI Pipeline (Preprocess → Inference → Lesion Measurement)** | `apps/ai_pipeline` |
| **Architecture - PostgreSQL / Object Storage / Audit / Quarantine / Model Registry / Backup** | ORM models + MinIO services + `ops/runbooks` |
| **Sitemap - Auth boundary** | `apps/web/src/features/auth` |
| **Sitemap - Shared account / session / errors** | `apps/web/src/features/shared` |
| **Sitemap - Radiologist** | `apps/web/src/features/radiologist` |
| **Sitemap - Stroke Physician** | `apps/web/src/features/physician` |
| **Sitemap - Head of Department** | `apps/web/src/features/governance` |
| **Sitemap - IT Administrator** | `apps/web/src/features/admin` |
| **Sitemap - Consultation session (cross-role)** | `apps/web/src/features/consultation` |
| **ERD - toàn bộ entity** | `apps/server/app/models/*` (đặt tên 1:1 với ERD) |

---

## 1. TỔNG QUAN KIẾN TRÚC MÃ NGUỒN (MONOREPO OVERVIEW)

Cấu trúc mã nguồn của **UDA-StrokeSeg** được thiết kế dưới dạng **Modular Monorepo** nhằm cô lập ranh giới trách nhiệm đúng 4 khối Architecture:

1. **Frontend Client (`apps/web`):** SPA React + TypeScript + TailwindCSS + Cornerstone3D, **chia feature theo Sitemap đa tầng / theo vai trò** (Radiologist, Stroke Physician, HoD, IT Admin) + Auth/Shared.
2. **Core Backend Gateway (`apps/server`):** API Gateway REST + Auth/RBAC + Study Intake endpoint + business logic FastAPI/SQLAlchemy/Pydantic; **ORM khớp 1:1 ERD PostgreSQL**.
3. **Event Bus & Dispatcher (`apps/event_bus`):** Pub/Sub (Celery / RabbitMQ / Redis), queue suy luận, SLA **180s**, Circuit Breaker → HOTL manual fallback; topics: `StudyValidated`, `MaskRevised`, `InferenceCompleted`, `SLATimeout`.
4. **AI Processing Pipeline (`apps/ai_pipeline`):** Preprocessing (DWI/ADC/FLAIR) → Segmentation Inference → Lesion Measurement (volume, diameter, territory); GPU-isolated.
5. **CI/CD & Clinical Test Harness (`.github/workflows`, `tests/`):** lint/test, clinical golden volumetry, dual-gate deploy.
6. **Vận hành & Phục hồi (`ops/runbooks`):** Backup/Restore **ngoài Web UI** (CLI / Bastion) - khớp Architecture “Backup & Restore (server-side)” và Sitemap “Restore via CLI/Bastion”.
7. **Workspace & hợp đồng chia sẻ (`pnpm-workspace.yaml`, `packages/*`):** pnpm workspaces liên kết `apps/web` ↔ `packages/*` (Node/TS); Enum/DTO Python (Pydantic/FastAPI OpenAPI) **sinh mã tự động** sang TypeScript - không chỉnh tay hai nơi.

---

## 2. CÂY THƯ MỤC CHI TIẾT (FULL DIRECTORY TREE)

```text
uda-strokeseg/
├── .github/                                     # CI/CD Workflows, Tự động hóa & MLOps Governance
│   ├── workflows/
│   │   ├── ci-web.yml                           # Frontend CI: Linting, Type-check, Component Unit Tests
│   │   ├── ci-server.yml                        # Backend CI: Ruff, Pytest, Alembic Migration Dry-run
│   │   ├── ci-ai-pipeline.yml                   # AI CI: Unit tests, Checksum verification, GPU test-stubs
│   │   ├── test-integration.yml                 # E2E Event-Driven: Pub/Sub, SLA 180s timeout
│   │   ├── test-clinical-golden.yml             # Algorithmic Validation: 2000-voxel → 32.000 mL
│   │   ├── cd-staging.yml                       # Staging Build: Multi-arch Docker & registry push
│   │   └── cd-production.yml                    # Production CD: Dual-Gate sign-off (IT + HoD)
│   ├── dependabot.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── clinical_defect.md
│       └── technical_bug.md
│
├── apps/                                        # Phân hệ ứng dụng (map System Architecture)
│   ├── web/                                     # [Web UI] Role-based SPA - Sitemap
│   │   ├── public/                              # Static assets, DICOM viewer workers
│   │   ├── src/
│   │   │   ├── assets/
│   │   │   ├── components/                      # Shared presentational UI
│   │   │   │   ├── common/                      # Button, Modal, Drawer, Badge, Toast, EmptyState
│   │   │   │   ├── dicom-viewer/                # Cornerstone3D: DWI/ADC/FLAIR sync (Architecture Mask Review)
│   │   │   │   │   ├── SynchronizedViewport.tsx
│   │   │   │   │   ├── WindowLevelControls.tsx
│   │   │   │   │   ├── HeatmapOverlay.tsx
│   │   │   │   │   └── VoxelCrosshair.tsx
│   │   │   │   ├── mask-editor/                 # HITL tools (Sitemap: Brush/Eraser/Threshold)
│   │   │   │   │   ├── BrushTool.tsx
│   │   │   │   │   ├── EraserTool.tsx
│   │   │   │   │   ├── Threshold3DTool.tsx
│   │   │   │   │   └── RevisionCompare.tsx      # Keep AI original vs adjusted
│   │   │   │   └── voice-dictation/             # Architecture: Speech-to-Text
│   │   │   │       ├── AudioRecorder.tsx
│   │   │   │       └── LiveTranscript.tsx
│   │   │   ├── features/                        # = Sitemap pillars (role + shared)
│   │   │   │   ├── auth/                        # [Sitemap] Auth boundary (orange links)
│   │   │   │   │   ├── LoginPage.tsx            # /auth/login
│   │   │   │   │   ├── ForgotPasswordPage.tsx   # /auth/forgot-password
│   │   │   │   │   ├── ResetPasswordPage.tsx    # /auth/reset-password
│   │   │   │   │   ├── OtpVerificationPage.tsx  # /auth/otp
│   │   │   │   │   ├── MfaModal.tsx             # Step-up / TOTP
│   │   │   │   │   └── SessionLockOverlay.tsx   # /auth/session-lock - 15 min idle
│   │   │   │   ├── shared/                      # [Sitemap] Account, session states, errors, notifications
│   │   │   │   │   ├── ApplicationHome.tsx      # Hub sau login → redirect theo Role (Sitemap Application Home)
│   │   │   │   │   ├── MyAccountPage.tsx        # Profile, status, logout
│   │   │   │   │   ├── SettingsPage.tsx
│   │   │   │   │   ├── PrivacyPolicyPage.tsx
│   │   │   │   │   ├── TermsOfServicePage.tsx
│   │   │   │   │   ├── NotificationsPanel.tsx   # All notifications / mark all as read
│   │   │   │   │   ├── Forbidden403Page.tsx
│   │   │   │   │   └── NotFound404Page.tsx
│   │   │   │   ├── radiologist/                 # [Sitemap] Radiologist workspace
│   │   │   │   │   ├── EmergencyWorklist.tsx    # /radiologist/worklist/emergency - SLA countdown
│   │   │   │   │   ├── AssignedWorklist.tsx     # /radiologist/worklist - AwaitingReview, roster guards
│   │   │   │   │   ├── DiagnosticStation.tsx    # /radiologist/workspace/:study_id
│   │   │   │   │   ├── ClinicalContextPanel.tsx # Patient/Accession, NIHSS, onset, QC
│   │   │   │   │   ├── LesionMetricsPanel.tsx   # LesionMeasurement (ERD)
│   │   │   │   │   ├── QcAiWarningsPanel.tsx
│   │   │   │   │   ├── ReportNotesPanel.tsx     # Impression + dictation
│   │   │   │   │   ├── ReportDraftPage.tsx      # Draft preview / export DRAFT PDF
│   │   │   │   │   ├── SignedReportPage.tsx    # Signed PDF + signer/version
│   │   │   │   │   ├── ClinicalFeedbackModal.tsx# AI disposition + utility (sign-off)
│   │   │   │   │   └── ReportignOffModal.tsx   # Step-up password, 5-min token, lock SignedOff
│   │   │   │   ├── physician/                   # [Sitemap] Stroke Physician portal
│   │   │   │   │   ├── PhysicianDashboard.tsx   # /physician/dashboard
│   │   │   │   │   ├── SignedOffCaseList.tsx    # /physician/cases - SignedOff only (no draft)
│   │   │   │   │   ├── CaseDetailHub.tsx        # /physician/cases/:study_id
│   │   │   │   │   ├── ReadOnlyImagingView.tsx  # Approved mask overlay (view-only)
│   │   │   │   │   ├── FinalMeasurementsPanel.tsx
│   │   │   │   │   ├── TreatmentDecisionPanel.tsx # /treatment-plan → ClinicalFeedback.TreatmentDecision
│   │   │   │   │   ├── ClinicalFeedbackForm.tsx
│   │   │   │   │   └── SecureReportDownload.tsx # Official signed PDF
│   │   │   │   ├── consultation/                # [Sitemap + Architecture] Multi-doctor panel
│   │   │   │   │   ├── ConsultationLobby.tsx    # List / create session, trigger reason
│   │   │   │   │   ├── VirtualReviewRoom.tsx    # Consultation/session/:id - WebSocket room
│   │   │   │   │   ├── CollaborativeCanvas.tsx  # Shared approved MRI + cursor sync
│   │   │   │   │   ├── MemberPollPanel.tsx      # AgreementWithAI
│   │   │   │   │   └── ConsensusFinalizeModal.tsx # Chair finalize + ConsensusNotes
│   │   │   │   ├── governance/                  # [Sitemap] Head of Department (NOT Ops Dashboard)
│   │   │   │   │   ├── ExecutiveOverview.tsx    # /governance/clinical-overview - acceptance telemetry
│   │   │   │   │   ├── ReviewerRosterPage.tsx   # /governance/roster
│   │   │   │   │   ├── AssignmentPoliciesPage.tsx # Escalation rules, round-robin / workload
│   │   │   │   │   ├── SlaQueueMonitor.tsx      # /governance/sla-monitor - fallback reassignment
│   │   │   │   │   ├── EmergencyFallbackQueue.tsx
│   │   │   │   │   ├── ClinicalModelApproval.tsx # Clinical release gate (Dual-Gate half)
│   │   │   │   │   ├── AiAdoptionAnalytics.tsx  # Privacy suppression n<5
│   │   │   │   │   └── CircuitBreakerModal.tsx  # Clinical suspend AI (UC-12)
│   │   │   │   └── admin/                       # [Sitemap] IT Administrator
│   │   │   │       ├── OpsDashboard.tsx         # /admin/telemetry-events/event-bus - Architecture Ops Dashboard
│   │   │   │       ├── IntakeValidationView.tsx # Task & intake details, series QC
│   │   │   │       ├── QuarantineLogViewer.tsx  # /admin/telemetry-events/quarantine-logs
│   │   │   │       ├── PacsIntegrationPage.tsx  # External PACS link, service account
│   │   │   │       ├── SiteScannerRegistry.tsx  # SiteSource + Scanner (ERD)
│   │   │   │       ├── UsersRbacManagement.tsx  # /admin/users - provisioning & permission matrix
│   │   │   │       ├── ModelRegistryCatalog.tsx # /admin/model-registry - import, checksum, dual-gate
│   │   │   │       ├── DomainAdaptationTree.tsx # Model lineage (DomainAdaptationRun)
│   │   │   │       ├── AiServiceControls.tsx    # Technical suspend + HoD clearance
│   │   │   │       ├── ImmutableAuditTrail.tsx  # /admin/telemetry-events/audit-logs (append-only)
│   │   │   │       ├── BackupMonitorPage.tsx    # Schedule/status only - restore = CLI
│   │   │   │       └── RunbookIndex.tsx         # Links to ops/runbooks (no restore button)
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useSessionTimeout.ts         # 15m idle + emergency keep-alive bypass
│   │   │   │   ├── useCornerstoneSync.ts
│   │   │   │   └── useWebSocketSla.ts           # SLA / consultation / queue push
│   │   │   ├── services/
│   │   │   │   ├── apiClient.ts
│   │   │   │   ├── websocketService.ts
│   │   │   │   └── storageService.ts            # Presigned URL → Object Storage
│   │   │   ├── stores/
│   │   │   │   ├── sessionStore.ts
│   │   │   │   ├── viewerStore.ts
│   │   │   │   └── queueStore.ts
│   │   │   ├── routes/
│   │   │   │   ├── AppRoutes.tsx                # Cây URL khớp Sitemap (xem §3.1)
│   │   │   │   └── ProtectedRoute.tsx           # RBAC deny-by-default
│   │   │   ├── types/                           # TS contracts khớp ERD
│   │   │   │   ├── study.types.ts               # Study, Series, StorageObject, SiteSource, Scanner
│   │   │   │   ├── mask.types.ts                # SegmentationMask, LesionMeasurement, InferenceTask
│   │   │   │   ├── model.types.ts               # Model, ModelVersion, DomainAdaptationRun
│   │   │   │   ├── consultation.types.ts        # Consultationession, ConsultationMember
│   │   │   │   ├── clinical.types.ts            # ClinicalFeedback, Report
│   │   │   │   └── telemetry.types.ts           # AuditLog, QuarantineLog, Reason
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── Dockerfile.web
│   │
│   ├── server/                                  # [API Gateway + Web Application Services]
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── v1/
│   │   │   │   │   ├── endpoints/
│   │   │   │   │   │   ├── auth.py              # login, MFA, refresh, step-up reauthenticate
│   │   │   │   │   │   ├── users.py             # UC-08 provisioning & RBAC (Sitemap Admin)
│   │   │   │   │   │   ├── studies.py           # Worklist metadata, case state
│   │   │   │   │   │   ├── series.py            # DWI/ADC/FLAIR series
│   │   │   │   │   │   ├── study_intake.py     # Architecture: Study Intake & Validation (PACS submit)
│   │   │   │   │   │   ├── masks.py             # Mask revisions → emit MaskRevised
│   │   │   │   │   │   ├── sign_off.py          # POST .../sign-offs
│   │   │   │   │   │   ├── Report.py           # PDF + DICOM SR export (Report & Export)
│   │   │   │   │   │   ├── Consultation.py
│   │   │   │   │   │   ├── feedback.py          # ClinicalFeedback / TreatmentDecision
│   │   │   │   │   │   ├── governance.py        # Roster, assignment policies, clinical gate
│   │   │   │   │   │   ├── operations.py        # POST /operations/suspension (Circuit Breaker)
│   │   │   │   │   │   ├── model_registry.py    # Dual-gate activation / rollback
│   │   │   │   │   │   ├── pacs.py              # PACS connection settings (Admin)
│   │   │   │   │   │   ├── quarantine.py
│   │   │   │   │   │   ├── audit.py             # Append-only; DELETE → 405
│   │   │   │   │   │   ├── notifications.py
│   │   │   │   │   │   └── dictation.py         # Speech-to-Text audio stream
│   │   │   │   │   └── router.py
│   │   │   │   └── deps.py                      # DbSession, CurrentUser, RBAC
│   │   │   ├── core/
│   │   │   │   ├── config.py
│   │   │   │   ├── security.py
│   │   │   │   ├── constants.py                 # SLA_SECONDS=180, modalities, CaseStatus
│   │   │   │   └── logging.py
│   │   │   ├── db/
│   │   │   │   ├── base.py
│   │   │   │   ├── session.py
│   │   │   │   └── migrations/
│   │   │   │       ├── env.py
│   │   │   │       ├── script.py.mako
│   │   │   │       └── versions/
│   │   │   ├── models/                          # SQLAlchemy ORM - tên entity = ERD 1:1
│   │   │   │   ├── user.py                      # User, Role (Belongs_to)
│   │   │   │   ├── site.py                      # SiteSource, Scanner
│   │   │   │   ├── study.py                     # Study, Series, StorageObject
│   │   │   │   ├── model.py                     # Model, ModelVersion, DomainAdaptationRun
│   │   │   │   ├── inference.py                 # InferenceTask (Triggered_by Study, Runs_on ModelVersion)
│   │   │   │   ├── mask.py                      # SegmentationMask (ParentMaskID self-ref), LesionMeasurement
│   │   │   │   ├── consultation.py              # Consultationession, ConsultationMember
│   │   │   │   ├── clinical.py                  # ClinicalFeedback, Report
│   │   │   │   └── telemetry.py                 # AuditLog, QuarantineLog, Reason
│   │   │   ├── schemas/
│   │   │   │   ├── auth_schema.py
│   │   │   │   ├── user_schema.py
│   │   │   │   ├── study_schema.py
│   │   │   │   ├── mask_schema.py
│   │   │   │   ├── consultation_schema.py
│   │   │   │   ├── clinical_schema.py
│   │   │   │   ├── model_schema.py
│   │   │   │   └── telemetry_schema.py
│   │   │   ├── services/
│   │   │   │   ├── auth_service.py
│   │   │   │   ├── user_service.py
│   │   │   │   ├── study_service.py
│   │   │   │   ├── study_intake_service.py     # Series completeness DWI+ADC+FLAIR; QC → Quarantine
│   │   │   │   ├── mask_service.py              # Revision + publish MaskRevised
│   │   │   │   ├── sign_off_service.py
│   │   │   │   ├── report_service.py            # PDF (ReportLab/WeasyPrint) + DICOM SR
│   │   │   │   ├── storage_service.py           # MinIO/S3 Object Storage
│   │   │   │   ├── event_publisher.py           # Pub/Sub topics (Architecture Event Bus)
│   │   │   │   ├── case_state_logger.py         # Architecture: Case State & Event Logger
│   │   │   │   └── audit_service.py
│   │   │   └── main.py                          # FastAPI + WebSocket endpoints
│   │   ├── requirements.txt
│   │   ├── pyproject.toml
│   │   └── Dockerfile.server
│   │
│   ├── event_bus/                               # [Architecture] Event Backbone & Distribution
│   │   ├── broker/
│   │   │   ├── config.py                        # Topics: StudyValidated, MaskRevised, InferenceCompleted, SLATimeout
│   │   │   └── client.py
│   │   ├── workers/
│   │   │   ├── intake_validation_worker.py      # Async validation after PACS C-STORE / intake API
│   │   │   ├── inference_dispatch_worker.py     # Automated Processing Queue → ai_pipeline
│   │   │   ├── circuit_breaker_telemetry.py     # 180s SLA → SLATimeout → HOTL fallback
│   │   │   ├── recompute_dispatcher.py          # MaskRevised → recompute LesionMeasurement
│   │   │   └── websocket_notifier.py            # Push → Ops Dashboard, Worklist, Consultation
│   │   ├── requirements.txt
│   │   └── Dockerfile.eventbus
│   │
│   └── ai_pipeline/                             # [Architecture] AI Processing Pipeline (GPU)
│       ├── pipeline/
│       │   ├── preprocessing/                   # DWI, ADC, FLAIR
│       │   │   ├── co_registration.py
│       │   │   ├── skull_stripping.py
│       │   │   ├── intensity_normalization.py
│       │   │   └── spatial_resampling.py
│       │   ├── inference/                       # Segmentation Inference (multi-center)
│       │   │   ├── model_loader.py              # Weights from Model Registry / Object Storage
│       │   │   ├── forward_pass.py
│       │   │   └── postprocessing.py
│       │   ├── volumetry/                       # Lesion Measurement
│       │   │   ├── connected_components.py      # ClusterCount
│       │   │   ├── native_volumetry.py          # LesionVolume (mL)
│       │   │   ├── morphometry.py               # Diameter, SurfaceArea
│       │   │   └── vascular_territory.py        # Laterality + VascularTerritory
│       │   └── runner.py                        # Consume queue; emit InferenceCompleted
│       ├── models/
│       │   ├── nnunet_3d_backbone.py
│       │   ├── fda_domain_adaptation.py
│       │   └── sdf_boundary_mining.py
│       ├── weights/                             # CACHE ONLY - KHÔNG commit binary vào Git
│       │   ├── .gitkeep                         # Giữ thư mục trống trên VCS
│       │   └── README.md                        # Hướng dẫn fetch weights (MinIO/S3 | DVC | Git LFS)
│       ├── scripts/
│       │   └── fetch_weights.py                 # Tải trọng số đã duyệt từ Model Registry / Object Storage
│       ├── requirements.txt
│       └── Dockerfile.ai
│
├── packages/                                    # Shared contracts / utilities (pnpm workspace packages)
│   ├── common-types/                            # Hợp đồng FE↔BE - TypeScript generated, không dual-edit
│   │   ├── src/
│   │   │   ├── enums.ts                         # GENERATED: CaseStatus, RoleName, TreatmentDecision, MaskType, Modality…
│   │   │   ├── dto.ts                           # GENERATED: DTO/OpenAPI schemas dùng chung SPA
│   │   │   └── index.ts
│   │   ├── package.json                         # @uda-strokeseg/common-types
│   │   └── README.md                            # Nguồn chân lý = Pydantic enums trên FastAPI
│   └── dicom-utils/
│       ├── py_dicom_utils/
│       │   ├── affine_validator.py
│       │   └── metadata_sanitizer.py
│       └── ts_dicom_utils/
│
├── ops/                                         # Architecture Data & Storage ops + PACS edge
│   ├── docker/
│   │   ├── docker-compose.dev.yml               # Postgres, MinIO, RabbitMQ, Web, API, workers
│   │   ├── docker-compose.prod.yml
│   │   └── env.example
│   ├── k8s/
│   │   ├── api-deployment.yaml
│   │   ├── ai-gpu-worker-daemonset.yaml
│   │   ├── ingress.yaml
│   │   └── configmap-secrets.yaml
│   ├── pacs-simulator/                          # External Systems: PACS / MRI DWI·ADC·FLAIR
│   │   ├── send_study_cstore.py
│   │   └── sample_studies/
│   └── runbooks/                                # Backup & Restore - server-side only
│       ├── backup_postgres.sh
│       ├── backup_minio_s3.sh
│       ├── disaster_recovery_runbook.md
│       └── dual_gate_activation_runbook.md
│
├── tests/
│   ├── clinical_golden/
│   │   ├── test_native_volumetry.py             # 2000 voxels → 32.000 mL
│   │   └── test_empty_mask_handling.py
│   ├── integration/
│   │   ├── test_pacs_intake_pipeline.py         # C-STORE → Intake → Event Bus → Processing
│   │   ├── test_sla_circuit_breaker.py          # >180s → Failed (processing failed)
│   │   └── test_mask_revision_conflict.py
│   └── e2e/
│       ├── radiologist_hitl_flow.spec.ts        # Worklist → Mask → Dictation → Sign-off
│       ├── physician_treatment_flow.spec.ts     # Signed-off cases → treatment → PDF
│       ├── consultation_session.spec.ts
│       ├── governance_sla_flow.spec.ts
│       └── rbac_guardrails.spec.ts
│
├── .editorconfig
├── .gitignore                                   # Bắt buộc: apps/ai_pipeline/weights/** (trừ .gitkeep/README)
├── .gitattributes                               # (tuỳ chọn) Git LFS patterns nếu dùng LFS cho artifacts
├── pnpm-workspace.yaml                          # Node workspaces: apps/web + packages/*
├── package.json                                 # Root workspace scripts (lint/web, gen:types)
├── dvc.yaml                                     # (tuỳ chọn) DVC pipeline kéo weights từ remote
├── Makefile                                     # Make targets: dev, test, lint, migrate, gen-types, fetch-weights
└── README.md
```

**Ghi chú cây thư mục - bắt buộc vận hành:**

* **`pnpm-workspace.yaml` (hoặc npm/yarn workspaces):** khai báo `apps/web` và `packages/*` để `apps/web` import `@uda-strokeseg/common-types` / `dicom-utils` qua workspace protocol - không copy type thủ công.
* **`packages/common-types`:** nguồn chân lý Enum/DTO nằm ở Backend (Pydantic models / FastAPI OpenAPI). Frontend **không** tự định nghĩa lại `CaseStatus`, `RoleName`, `TreatmentDecision`, `MaskType`, …; chạy codegen (`openapi-typescript`, `datamodel-code-generator` ↔ `pydantic-to-typescript`, hoặc export OpenAPI → TS) mỗi khi schema BE đổi. CI fail nếu diff generated types chưa commit.
* **`apps/ai_pipeline/weights/`:** trọng số nnU-Net (hàng trăm MB–vài GB) **không** commit vào Git. Thêm vào `.gitignore`; chỉ giữ `.gitkeep` + README. Runtime/CI gọi `scripts/fetch_weights.py` tải từ MinIO/S3 (Model Registry) theo checksum đã Dual-Gate; môi trường nghiên cứu có thể dùng **DVC** hoặc **Git LFS** thay thế - vẫn không nhét `.pt`/`.onnx` lớn vào lịch sử Git thuần.

---

## 3. ĐẶC TẢ CHI TIẾT TỪNG PHÂN HỆ VÀ ÁNH XẠ KIẾN TRÚC

### 3.1 Nhóm Ứng dụng Giao diện (`apps/web`)

* **Trách nhiệm:** Triển khai Single Page Application phục vụ toàn bộ các tác nhân y tế và quản trị viên, tuân thủ nghiêm ngặt chuẩn Clinical UX và sitemap đã được duyệt (`Sitemap design.png` + `Sitemap.png`).
* **Tổ chức thư mục `src/features/`:** Phân tách rõ ràng các module tương ứng với phân vùng Sitemap & quyền hạn:
  * `auth/`: Quản lý vòng đời đăng nhập (Login, Forgot/Reset Password, OTP), MFA, và bộ đếm $15\,\text{phút}$ không tương tác (`useSessionTimeout.ts`). Nếu phát hiện màn hình đang mở ca cấp cứu, cờ `emergency keep-alive` sẽ tự động kích hoạt nhằm bảo đảm an toàn tính mạng bệnh nhân (Architecture: Auth & RBAC Sessions - bypass khi Active Emergency Read).
  * `shared/`: Application Home (điều hướng theo Role sau login), My Account / Settings, Privacy & Terms, Notifications (mark all as read), trang lỗi `403`/`404` - khớp nhánh account & session states trên Sitemap.
  * `radiologist/`: Trạm làm việc của Bác sĩ Chẩn đoán hình ảnh. Tích hợp `Cornerstone3D` để xem đồng bộ lát cắt đa chuỗi xung (DWI, ADC, FLAIR), thanh công cụ vẽ sửa mask (HITL Brush/Eraser/Threshold), bộ đếm ngược SLA $180\,\text{s}$ qua WebSocket, module thu âm giọng nói chẩn đoán sơ bộ (Speech-to-Text), báo cáo Draft/Signed PDF và modal ký số xác thực bước hai (`Step-up Token`).
  * `physician/`: Cổng thông tin của Bác sĩ Điều trị Đột quỵ. Danh sách ca **đã SignedOff** (tuyệt đối không xem draft), theo dõi mốc giờ vàng ($<4.5\,\text{h}$, $4.5\,\text{h}-24\,\text{h}$), màn hình xem ảnh chỉ đọc (Read-only Approved Mask), ma trận chỉ định tiêu sợi huyết (r-tPA) / can thiệp nội mạch (EVT) lưu vào `ClinicalFeedback.TreatmentDecision`, và xuất bệnh án PDF đã ký.
  * `consultation/`: Phân hệ Hội chẩn Đa chuyên khoa (Architecture: Consultation & Panel Review). Cung cấp phòng hội chẩn trực tuyến thời gian thực (`VirtualReviewRoom.tsx`), đồng bộ lát cắt và con trỏ chuột đa bác sĩ trên Canvas chung, bảng bỏ phiếu đồng thuận kết quả AI (`MemberPollPanel.tsx`) và chức năng ký duyệt biên bản của Chủ tọa.
  * `governance/`: Bảng chỉ huy của Trưởng khoa (Sitemap HoD). Giám sát clinical overview & tỷ lệ chấp thuận AI, quản lý Reviewer Roster & assignment/escalation policies, theo dõi tỷ lệ hoàn tất dưới $180\,\text{s}$, hàng đợi ca quá hạn cần phân công đọc thủ công (`EmergencyFallbackQueue.tsx`), cổng phê duyệt lâm sàng model (Clinical Gate), và nút ngắt mạch AI vì lý do an toàn lâm sàng (`CircuitBreakerModal.tsx`). **Không** chứa Ops Dashboard kỹ thuật.
  * `admin/`: Phân hệ Quản trị viên IT (Sitemap IT Administrator + Architecture Ops Dashboard). Ops Dashboard (queue/job/SLA alerts kỹ thuật), Study Intake & Quarantine, PACS / `SiteSource` / `Scanner`, Users & RBAC, Model Registry (import, checksum, Technical Gate, Dual-Gate), Audit Log bất biến, Backup **monitor** (restore chỉ qua CLI/Bastion - không nút Restore trên Web UI).

* **Cây route mục tiêu (khớp Sitemap + test plan):**

```text
/auth/login | /auth/forgot-password | /auth/reset-password | /auth/otp | /auth/session-lock
/                            → ApplicationHome (role redirect)
/account | /settings | /privacy | /terms | /notifications
/radiologist/worklist[/emergency]
/radiologist/workspace/:study_id
/radiologist/Report[/draft|/signed]
/physician/dashboard
/physician/cases[/:study_id[/treatment-plan]]
Consultation[/lobby|/session/:consultation_id]
/governance/clinical-overview
/governance/roster
/governance/sla-monitor
/governance/assignment-policies
/governance/model-approval
/admin/telemetry-events/event-bus          # Ops Dashboard
/admin/telemetry-events/quarantine-logs
/admin/telemetry-events/audit-logs
/admin/pacs
/admin/sites-scanners
/admin/users
/admin/model-registry
/admin/backups                             # monitor only
```

### 3.2 Nhóm Cổng Dịch vụ Máy chủ (`apps/server`)

* **Trách nhiệm:** Tiếp nhận yêu cầu REST/WebSocket, thẩm định danh tính, thực thi quy tắc nghiệp vụ y tế, ghi vết kiểm toán và quản lý giao dịch cơ sở dữ liệu PostgreSQL. Bao gồm các dịch vụ Architecture: API Gateway, Auth & RBAC, Study Intake & Validation, Report & Export (PDF + DICOM SR), Case State & Event Logger.
* **Study Intake & Validation:** Endpoint/service `study_intake` nhận luồng PACS (submit-only service account) → kiểm tra đủ DWI/ADC/FLAIR + hình học → hợp lệ thì lưu Object Storage và phát `StudyValidated`; lỗi thì ghi `QuarantineLog` + `Reason`. Worker async nằm ở `apps/event_bus`.
* **Tổ chức thư mục `app/models/` (Ánh xạ 1:1 với ERD):**
  * `user.py`: Chứa các thực thể `User`, `Role` (quản lý AccessLevel và Permission).
  * `site.py`: Chứa các thực thể `SiteSource`, `Scanner` (quản lý thông số kỹ thuật máy MRI, FieldStrength, Vendor, ProtocolConfig).
  * `study.py`: Chứa các thực thể `Study` (lưu trữ mã ẩn danh Patient, chỉ số lâm sàng BaselineNIHSS, PreStroke_mRS, SymptomOnsetTime, TimeFromOnset_Hours, AccessionNo, QCStatus), `Series` (thông số chuỗi xung EchoTime, PixelSpacing, AffineMatrix, SequenceType) và `StorageObject` (đường dẫn FileURL, FileSize, FileType trên MinIO/S3).
  * `model.py`: Chứa các thực thể `Model`, `ModelVersion` (quản lý VersionTag, DeploymentStatus) và quan hệ phả hệ đệ quy `DomainAdaptationRun` (quản lý Source_VersionID, Target_VersionID, BaselineTargetDice, AdaptedTargetDice).
  * `inference.py`: Chứa thực thể `InferenceTask` (ExecutionStatus, ExecutionQueue, ExecutionTime, StartedAt, CompletedAt, ErrorMessage) - Triggered_by Study, Runs_on ModelVersion.
  * `mask.py`: Chứa thực thể `SegmentationMask` hỗ trợ liên kết đệ quy `ParentMaskID` (bảo toàn lịch sử các bản sửa đổi; MaskType, ApprovalStatus, DiceScore) và thực thể yếu `LesionMeasurement` (lưu trữ LesionVolume, ClusterCount, Laterality, VascularTerritory, SeverityGrade, SurfaceArea, Diameter).
  * `consultation.py`: Chứa thực thể `Consultationession` (lưu TriggerReason, Status, ConsensusNotes) và thực thể yếu `ConsultationMember` (lưu RoleInSession, AgreementWithAI, Comments).
  * `clinical.py`: Chứa thực thể `ClinicalFeedback` (lưu ClinicalUtilityRating, TreatmentDecision) và `Report` (lưu thông tin ký số SignedBy, ReportVersion, bản PDF / DICOM SR chính thức).
  * `telemetry.py`: Chứa các thực thể kỹ thuật `QuarantineLog` & `Reason` (lưu vết ca lỗi hình học từ chối từ PACS) và `AuditLog` (nhật ký kiểm toán an ninh chỉ ghi, lưu IP, Timestamp, Device, PayloadSnapshot).

### 3.3 Nhóm Hàng đợi & Điều phối Thông điệp (`apps/event_bus`)

* **Trách nhiệm:** Hiện thực hóa kiến trúc Event-Driven (Pub/Sub) đúng khối Architecture “Event Backbone & Distribution”, giải phóng máy chủ web khỏi các tác vụ nặng và kiểm soát chất lượng thời gian thực.
* **Các tiến trình Worker cốt lõi:**
  * `intake_validation_worker.py`: Lắng nghe chuỗi xung DICOM từ cổng tiếp nhận PACS / Study Intake, kiểm tra tính đầy đủ của 3 chuỗi xung bắt buộc (DWI, ADC, FLAIR), kiểm tra tính nhất quán hình học; hợp lệ → `StudyValidated`; lỗi → đẩy sang `QuarantineLog`.
  * `inference_dispatch_worker.py`: Nhận job từ Automated Processing Queue và điều phối sang `apps/ai_pipeline`.
  * `circuit_breaker_telemetry.py`: Quản lý bộ đếm ngược SLA $180\,\text{s}$ cho từng ca bệnh đang chạy suy luận. Nếu thời gian vượt quá $180\,\text{s}$, worker sẽ tự động phát sự kiện `SLATimeout`, đánh dấu ca bệnh là `Failed (processing failed)` và đưa vào hàng đợi đọc thủ công khẩn cấp (HOTL Manual Fallback).
  * `recompute_dispatcher.py`: Lắng nghe sự kiện `MaskRevised` khi bác sĩ CĐHA lưu viền chỉnh sửa mới, kích hoạt lệnh tính toán lại thể tích và chỉ số định lượng trong không gian gốc.
  * `websocket_notifier.py`: Duy trì kết nối hai chiều với trình duyệt, đẩy thông báo trạng thái hàng đợi lên Ops Dashboard & Worklist, cảnh báo khẩn cấp và tọa độ tương tác trong phòng hội chẩn ảo.

### 3.4 Nhóm Xử lý Trí tuệ Nhân tạo (`apps/ai_pipeline`)

* **Trách nhiệm:** Thực thi chu trình xử lý hình ảnh 3D và chạy mô hình mạng nơ-ron tích chập UDA nnU-Net trên môi trường GPU độc lập - khớp khối Architecture “AI Processing Pipeline”.
* **Quy trình xử lý tuần tự (`pipeline/`):**
  1. `preprocessing/`: Thực hiện đồng quy chuẩn không gian giữa các chuỗi xung (Co-registration), bóc tách sọ não (Skull-stripping), chuẩn hóa cường độ tín hiệu voxel (Z-score) và nội suy độ phân giải không gian cho DWI, ADC, FLAIR.
  2. `inference/`: Nạp trọng số mô hình đã được phê duyệt từ Model Registry / Object Storage, thực hiện forward pass 3D sliding-window, sinh bản đồ nhiệt xác suất tổn thương (Probability Heatmap) và trích xuất mặt nạ nhị phân theo ngưỡng tối ưu $\tau^*$.
  3. `volumetry/`: Thuật toán định lượng đo đạc trực tiếp trên lưới voxel gốc (Native Space) để triệt tiêu sai số biến dạng hình học:
     $$V_{\text{lesion}} = \frac{|\{v : \hat{Y}_v = 1\}| \times V_{\text{voxel}}}{1000} \quad (\text{mL})$$
     Đồng thời xác định số lượng ổ tổn thương (Connected Components / ClusterCount), bán cầu não (`Laterality`), vùng cấp máu động mạch (`VascularTerritory`), Diameter và SurfaceArea; sau đó phát sự kiện `InferenceCompleted`.
* **Trọng số mô hình (`weights/`):** thư mục chỉ là cache cục bộ. `.gitignore` chặn `*.pt`, `*.pth`, `*.ckpt`, `*.onnx` và toàn bộ nội dung `weights/` (trừ `.gitkeep`, `README.md`). Worker khởi động / Makefile target `fetch-weights` gọi `scripts/fetch_weights.py` để kéo bản Active từ Model Registry (Object Storage) và xác minh SHA-256 trước khi `model_loader.py` nạp GPU. Không bao giờ `git add` file trọng số vào repository.

### 3.5 Hợp đồng chia sẻ & Workspace Monorepo (`packages/*`, `pnpm-workspace.yaml`)

* **Vấn đề:** `apps/web` dùng TypeScript; `apps/server`, `apps/event_bus`, `apps/ai_pipeline` dùng Python. Nếu Enum như `CaseStatus`, `RoleName`, `TreatmentDecision`, `MaskType` được sửa tay ở hai nơi sẽ lệch hợp đồng API và gây lỗi runtime/RBAC khó phát hiện.
* **Quy ước source of truth:** định nghĩa Enum/DTO trên Backend (Pydantic / SQLAlchemy enums khớp ERD) → FastAPI xuất OpenAPI schema → sinh TypeScript vào `packages/common-types/src/` bằng một trong các công cụ:
  * `openapi-typescript` (hoặc `openapi-typescript-codegen`) từ `/openapi.json` của FastAPI; hoặc
  * `pydantic-to-typescript` / pipeline tương đương khi muốn map trực tiếp từ model Pydantic.
* **Luồng bắt buộc khi đổi schema BE:**
  1. Sửa Pydantic/ORM trên `apps/server`.
  2. Chạy `make gen-types` (hoặc `pnpm gen:types`) → cập nhật `packages/common-types`.
  3. `apps/web` chỉ import từ `@uda-strokeseg/common-types` - cấm hard-code lại Enum.
  4. CI so sánh artifact generated; PR thiếu sync types → fail.
* **Workspace package manager:** tại root đặt `pnpm-workspace.yaml` (khuyến nghị; có thể thay bằng npm/yarn workspaces) với khoảng:

```yaml
packages:
  - "apps/web"
  - "packages/*"
```

  Root `package.json` khai báo scripts (`dev:web`, `lint:web`, `gen:types`) và phụ thuộc workspace. Phần Python vẫn quản lý bằng `requirements.txt` / `pyproject.toml` từng app - pnpm **không** thay thế môi trường Python, chỉ liên kết cây Node/TS.

---

## 4. CHIẾN LƯỢC TỰ ĐỘNG HÓA CI/CD & KIỂM THỬ LÂM SÀNG

Cấu hình trong thư mục `.github/workflows/` thiết lập các hàng rào kiểm soát chất lượng nghiêm ngặt trước khi mã nguồn được phép tích hợp hoặc triển khai:

```
[Mã nguồn mới / PR]
        │
        ├──> [1. CI Web & Server] ──> Linting, Type-check, Unit tests, Migration dry-run
        │
        ├──> [2. CI AI & Algorithmic] ──> Test thuật toán thể tích 2000-voxel (Chuẩn 32.000 mL)
        │
        ├──> [3. Integration Test] ──> Mock PACS Intake -> Event Bus Pub/Sub -> SLA 180s Timeout
        │
        └──> [4. E2E Playwright] ──> Test toàn bộ User Flows (Radiologist HITL, Physician r-tPA,
                                      Consultation, Governance SLA, Admin RBAC)
                                                │
                                                ▼ (Tất cả PASS)
                                     [Đóng gói Docker Images]
                                                │
                                                ▼
                         [Cổng phê duyệt Kép (Dual-Gate Deployment)]
                         ├── Cổng 1: Phê duyệt Kỹ thuật (IT Administrator)
                         └── Cổng 2: Phê duyệt Lâm sàng (Head of Department)
                                                │
                                                ▼ (Đủ 2 phê duyệt)
                                   [Triển khai Kubernetes Production]
```

1. **`ci-web.yml` & `ci-server.yml`:** Kiểm tra cú pháp, tĩnh học mã nguồn, kiểm tra hợp đồng API DTOs, **chạy lại codegen OpenAPI → `packages/common-types` và fail nếu diff**, đồng thời xác minh tính tương thích của các tệp di chuyển cơ sở dữ liệu Alembic với ERD. Job AI/CD **không** commit weights; chỉ gọi `fetch_weights` từ registry khi cần GPU test stub / staging.
2. **`test-clinical-golden.yml`:** Kiểm tra thuật toán y tế vàng (`TC-ALG-VOLUMETRY`). Chạy ma trận giả lập $128 \times 128 \times 32$ voxels với độ phân giải $2.0 \times 2.0 \times 4.0\,\text{mm}$. Đúng $2,000$ voxels tổn thương bắt buộc phải tính toán ra chính xác $32.000\,\text{mL}$ với sai số $< 10^{-6}\,\text{mL}$. Nếu sai lệch, pipeline sẽ lập tức bị hủy bỏ.
3. **`test-integration.yml`:** Khởi chạy cụm kiểm thử tích hợp (Docker Compose gồm PostgreSQL, MinIO, RabbitMQ). Sử dụng công cụ `pacs-simulator` bắn chuỗi ảnh DICOM giả lập để xác minh chu trình chuyển đổi trạng thái: `Received` $\to$ `Processing` $\to$ `AwaitingReview`. Đồng thời giả lập worker AI bị treo để xác nhận Circuit Breaker ngắt mạch đúng mốc $180\,\text{s}$ và chuyển ca sang trạng thái `Failed (processing failed)`.
4. **`cd-production.yml` (Dual-Gate CD):** Tuân thủ tuyệt đối quy tắc quản trị y tế (HOTL). Quy trình triển khai hoặc kích hoạt phiên bản mô hình AI mới trên môi trường vận hành chính thức bắt buộc phải có đủ chữ ký số điện tử từ cả Quản trị viên Kỹ thuật (`Technical Gate Approved`) và Trưởng khoa Lâm sàng (`Clinical Gate Approved`).

---

## 5. CẨM NANG VẬN HÀNH HẠ TẦNG VÀ PHỤC HỒI SỰ CỐ (RUNBOOKS)

Tuân thủ nghiêm ngặt chỉ đạo của Trưởng bộ môn và Architecture “Backup & Restore (server-side)”, giao diện Web UI tuyệt đối không chứa nút bấm khôi phục hệ thống (Restore). `BackupMonitorPage` chỉ cho phép xem lịch/trạng thái. Mọi tác vụ bảo trì và khắc phục sự cố được quy định chi tiết trong thư mục `ops/runbooks/`:

### 5.1 Kịch bản Sao lưu Định kỳ (`ops/runbooks/backup_postgres.sh` & `backup_minio_s3.sh`)
* **Cơ sở dữ liệu:** Tự động tạo bản sao lưu nhất quán (Consistent Snapshot) của PostgreSQL thông qua `pg_dump` vào mỗi 01:00 AM hàng ngày, mã hóa bằng chuẩn AES-256 và lưu trữ biệt lập.
* **Kho đối tượng (Object Storage):** Đồng bộ các tệp DICOM gốc, NIfTI masks và báo cáo PDF đã ký duyệt từ MinIO/S3 sang vùng lưu trữ lạnh (Cold Storage) có bật cờ bất biến WORM (Write Once, Read Many).

### 5.2 Quy trình Phục hồi Ngoài luồng (`ops/runbooks/disaster_recovery_runbook.md`)
* **Nguyên tắc:** Khi máy chủ gặp thảm họa (Crash, Corrupt dữ liệu, Tấn công mã độc), kỹ sư hệ thống bắt buộc phải ngắt kết nối mạng công cộng, truy cập thông qua máy trạm quản trị an toàn (Bastion Host / SSH Console) và thực hiện tuần tự các bước:
  1. Kiểm tra tính toàn vẹn và mã băm SHA-256 của tệp snapshot sao lưu gần nhất.
  2. Khởi tạo cụm cơ sở dữ liệu trắng biệt lập ngoài băng tầng Web.
  3. Nạp lại cấu trúc bảng và dữ liệu thông qua lệnh CLI:
     ```bash
     psql -h secure-db-host -U postgres -d uda_strokeseg_db < backup_20261110_consistent.sql
     ```
  4. Đồng bộ lại bucket MinIO/S3 tương ứng với các khóa `StorageID` đã ghi nhận trong bảng `StorageObject`.
  5. Chạy bộ kiểm thử toàn vẹn (`tests/clinical_golden/test_native_volumetry.py`) trước khi mở lại kết nối mạng cho cổng dịch vụ Web API.

---

## 6. CHECKLIST ĐỒNG BỘ VỚI 3 DIAGRAM

- [x] 4 vai trò Sitemap = 4 feature folders (+ auth/sharedConsultation)
- [x] Ops Dashboard thuộc **IT Admin**, không gộp vào HoD
- [x] Auth/account/home/notifications/errors có trong tree
- [x] Study Intake nằm server + event worker (Architecture)
- [x] Event topics & 180s Circuit Breaker có worker riêng
- [x] AI pipeline 3 bước Preprocess → Inference → Measurement
- [x] ERD entities đủ & tên chuẩn (`SiteSource`, `SegmentationMask`, `Reason`, `InferenceTask`, …)
- [x] Report export gồm PDF + DICOM SR
- [x] Backup/Restore chỉ `ops/runbooks`, không trên Web UI
- [x] `packages/common-types` sinh từ OpenAPI/Pydantic (không dual-edit Enum FE/BE)
- [x] `apps/ai_pipeline/weights/` gitignored; fetch từ MinIO/S3 (hoặc DVC/Git LFS)
- [x] Root `pnpm-workspace.yaml` liên kết `apps/web` + `packages/*`
