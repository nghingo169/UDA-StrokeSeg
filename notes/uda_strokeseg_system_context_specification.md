# UDA-StrokeSeg: AI-Based Diagnostic Support System for Acute Ischemic Stroke Using Lesion Segmentation on Multi-Center MRI

> **Document Type:** System Context & Specification  
> **Source Project:** Specialized Project / Capstone Project - Ho Chi Minh City University of Technology (HCMUT), Faculty of CSE (Dec 2026)  
> **Target Audience:** Software architects and project implementers  

---

## 1. Executive Summary & Core Research Problem

### 1.1 Clinical & Machine Learning Problem
- **Domain:** Acute Ischemic Stroke (AIS) lesion segmentation and lesion-burden quantification from 3D multi-sequence brain MRI: **DWI** ($b=1000\,\text{s/mm}^2$), **ADC** (Apparent Diffusion Coefficient), and **FLAIR** (Fluid-Attenuated Inversion Recovery).
- **Core ML Challenge (Compound Domain Shift):** Deep learning segmentation models trained on MRI data from one hospital/scanner drop significantly in performance when transferred to another hospital due to variations in:
  - Scanner vendors (e.g., Philips 3.0T vs. Siemens 3.0T).
  - Field strength ($1.5\text{T}$ vs. $3.0\text{T}$).
  - Acquisition slice thickness ($2.0\,\text{mm}$ thin isotropic vs. $4.8\,\text{mm}$ thick anisotropic causing severe Partial Volume Effects - PVE).
  - Extreme Class Imbalance: Acute micro-lesions occupy $< 0.1\%$ (often $< 0.05\%$) of total intracranial volume.
- **Proposed Solution:** **Unsupervised Domain Adaptation (UDA)**. Train on labeled source-center scans ($\mathcal{D}_S$) and unlabeled target-center scans ($\mathcal{D}_T$). The core methodology pairs:
  1. Low-frequency Fourier Domain Adaptation (FDA) ($\beta \in [0.01, 0.05]$).
  2. 3D nnU-Net encoder-decoder backbone.
  3. Arterial Territories Atlas-constrained contrastive alignment ($\text{MCA}, \text{ACA}, \text{PCA}, \text{VB}$).
  4. Lesion-boundary hard-negative mining via Signed Distance Function (SDF).

### 1.2 System Nature & Boundary
- **Diagnostic Decision Support System (NOT Autonomous Diagnostic Agent):** The system produces provisional draft masks and quantitative volumetry. It **never** issues an autonomous clinical diagnosis, does not determine reperfusion therapy eligibility, and does not calculate perfusion-defined penumbra (ISLES 2022 provides a single binary ischemic core lesion mask).
- **Clinical Governance Paradigms:**
  - **Human-in-the-Loop (HITL):** Every patient case must be inspected, optionally corrected, and formally signed off by an assigned Radiologist before clinical release.
  - **Human-on-the-Loop (HOTL):** Head of Department (HoD) and IT Administrator govern operational telemetry, review backlogs, quality thresholds, circuit-breaker service suspension, and dual-gate model activation/rollback.

---

## 2. System Stakeholders & Role-Based Access Control (RBAC)

The system enforces strict **Separation of Duties**:

| Role / Actor | System Responsibility | Prohibited Actions (Strict Guardrails) |
| :--- | :--- | :--- |
| **PACS (External System)** | Sends DICOM series automatically via C-STORE using a dedicated service identity. | Cannot view cases, query results, or access clinical workspaces. |
| **Radiologist / Neuroradiologist** | Reads assigned awaiting-review cases; inspects synchronized DWI/ADC/FLAIR; edits mask slice-by-slice; enters preliminary diagnostic impression; executes step-up sign-off; exports draft/signed PDF. | Cannot activate new models or perform IT administration. |
| **Stroke Physician / Neurologist** | Views **only signed-off cases**; reads radiologist's clinical impression, lesion volume/count/laterality; exports final clinical PDF report for clinical workflow. | **Cannot** edit masks, sign off cases, or access draft/awaiting-review cases. |
| **Head of Department (HoD)** | Governs clinical reviewer roster, assignment policies, turnaround/SLA rules; monitors aggregate acceptance rates; suspends AI service for clinical-safety concerns; gives **Clinical Release Approval** for models. | **Cannot** edit masks, sign off individual cases, manage user accounts, or deploy models unilaterally. |
| **IT Administrator** | Provisions/deactivates accounts; configures PACS connectivity; monitors queue telemetry and hardware resources; executes backups/recovery; imports model packages; verifies technical readiness; triggers technical suspension. | **Cannot** sign off clinical cases, edit masks, or self-assign clinical roles. |

---

## 3. End-to-End Clinical & Operational Workflow

```
[1. PACS / Intake]
     │ C-STORE (DWI, ADC, FLAIR)
     ▼
[2. Intake QC & Validation Service]
     ├── Pass: Convert to NIfTI -> Store in Object Storage -> State: "Processing"
     └── Fail: Quarantine Log -> State: "Failed" (Reason: "validation failed") -> HALT
     │
     ▼ (Asynchronous Queue - Celery/EventBus)
[3. 3D nnU-Net AI Inference & Measurement Engine]
     ├── Preprocessing (Co-registration, Skull-stripping, Resampling, Intensity Normalization)
     ├── 3D Forward Inference -> Generate Probability Heatmap & Binary Mask (at threshold τ*)
     ├── Native-space Volumetry (Volume mL, Connected Component Count, Laterality, Vascular Territory)
     ├── Execution SLA Guard: 180s target. If timeout -> State: "Failed" ("processing failed")
     └── Success -> State: "AwaitingReview"
     │
     ▼
[4. Radiologist Clinical Workspace (HITL Gate)]
     ├── View Synchronized DWI/ADC/FLAIR + Heatmap + Mask Overlay
     ├── Action A: Accept AI Mask unchanged (Disposition: "accepted_unchanged")
     ├── Action B: Edit mask slice-by-slice (Appends immutable revision -> Auto-recalculates measurements -> Disposition: "accepted_with_adjustment")
     ├── Action C: Reject AI output (Disposition: "not_used" + Mandatory reason -> Excludes AI volumetry)
     │
     ▼ Step-up Re-authentication (5-minute TTL Token)
[5. Sign-off & Report Finalization]
     ├── Enters Preliminary Diagnostic Impression -> Lock Mask -> State: "SignedOff"
     └── Generate Signed PDF Report (Stamped official, bound to ModelVersion + MaskVersion)
     │
     ▼
[6. Stroke Physician Access & Interpretation]
     └── Access released report, radiologist impression, and quantitative summary for clinical decisions.
```

---

## 4. Case State Machine & Invariants

```
               ┌───────────────┐
               │   Received    │
               └───────┬───────┘
                       │ Intake QC Validation
         ┌─────────────┴─────────────┐
         ▼ Fail                      ▼ Pass
   ┌───────────┐               ┌───────────┐
   │  Failed   │               │Processing │
   │(validation│               └─────┬─────┘
   │  failed)  │                     │ Inference Engine
   └───────────┘         ┌───────────┴───────────┐
                         ▼ Fail / Timeout (>180s)▼ Success
                   ┌───────────┐           ┌───────────────┐
                   │  Failed   │           │AwaitingReview │◄──┐ (Editable
                   │(processing│           └───────┬───────┘   └──  Mask Revisions)
                   │  failed)  │                   │ Radiologist Sign-Off
                   └───────────┘                   ▼ (Requires Step-Up Token)
                                           ┌───────────────┐
                                           │   SignedOff   │ (FINAL & IMMUTABLE)
                                           └───────────────┘
```

### Critical State Invariants:
1. **No Auto-Sign-Off:** A case can **never** transition from `Processing` directly to `SignedOff`.
2. **Immutability of Signed Cases:** A `SignedOff` case cannot be edited, reopened, or re-signed. Any correction requires re-submitting the study from PACS as an entirely new case.
3. **Empty Mask Handling:** An AI prediction resulting in $0.000\,\text{mL}$ (empty mask) moves to `AwaitingReview` with a mandatory UI warning: *"Empty mask is model output, NOT proof of negative stroke"*. It still requires manual clinical reading.
4. **Draft Watermarking:** Any PDF report exported before final radiologist sign-off must carry an indelible `DRAFT` watermark.

---

## 5. AI & Domain Adaptation Architecture

### 5.1 Formulation
- **Input:** $I \in \mathbb{R}^{3 \times H \times W \times D}$ (Channels: DWI, ADC, FLAIR).
- **Network:** Symmetric 5-stage 3D convolutional encoder-decoder with anisotropic convolutions, residual blocks, instance normalization, and deep supervision.
- **Output:** Voxel-wise probability map $f_\theta(I) \in [0, 1]^{H \times W \times D}$. Binary mask $\hat{Y} = \mathbb{I}_{[f_\theta(I) > \tau^*]}$.
- **Native-space Volumetry:**
  $$V_{\text{lesion}} = \frac{|\{v : \hat{Y}_v = 1\}| \times V_{\text{voxel}}}{1000} \quad (\text{mL})$$
  *(Calculated on native voxel grid to prevent deformation distortion).*

### 5.2 Training Components (Excised at Clinical Inference)
1. **Low-Frequency Fourier Domain Adaptation (FDA):**
   $$A_{\hat{S} \to T} = M_\beta \odot A(x^T) + (1 - M_\beta) \odot A(x^S), \quad \beta \in [0.01, 0.05]$$
2. **Supervised Loss (Source):** Soft Dice + Focal Loss ($\gamma = 2.0$) with deep supervision over 3 decoder stages.
3. **Arterial Territory Prior ($T_k$):** Voxel coordinates mapped via MNI registration to the Arterial Territories Atlas ($\text{MCA}, \text{ACA}, \text{PCA}, \text{VB}$) to prevent semantic collapse between random brain regions.
4. **SDF Boundary Hard-Negative Mining:**
   - Reliable Core ($P^+_{\delta+}$): $\Phi(u) \le -\delta_+$
   - Peri-lesional Hard Negatives ($H^-_{\delta-}$): $0 < \Phi(v) \le \delta_-$
   - Negative penalty weight: $w(v) = \exp\left(-\frac{\Phi(v)}{\sigma}\right)$ ($\sigma = 1.5\,\text{mm}$).

---

## 6. Relational Database Schema (PostgreSQL)

```
===================================================================================
                               RELATIONAL MODEL
===================================================================================

[DatasetSite] (1) ──< (N) [Scanner] (1) ──< (N) [Study] (1) ──< (N) [Series]
                                                  │ (1)                 │ (N)
                                                  │                     ▼ (1)
                                                  │              [StorageObject]
                                                  │                     ▲
                                                  ├──< (N) [InferenceTask]  │
                                                  │                     │
                                                  ├──< (N) [SegmentationMask] ──┤ (StorageID)
                                                  │         │ (1) self-ref (ParentMaskID)
                                                  │         │
                                                  │         ├──< (N) [LesionMeasurement]
                                                  │         │
                                                  │         └──< (1) [ClinicalFeedback]
                                                  │
                                                  ├──< (N) [Consultationession]
                                                  │         │ (1)
                                                  │         ├──< (N) [ConsultationMember]
                                                  │         └─── (1) [SegmentationMask] (Consensus)
                                                  │
                                                  ├──< (1) [Report] ────> [StorageObject]
                                                  │
                                                  └──< (N) [AuditLog]

[Model] (1) ──< (N) [ModelVersion] (1) ──< (N) [SegmentationMask]
                         │
                         ├──< [DomainAdaptationRun] (Source_VersionID, Target_VersionID)
                         └──< [MODEL_APPROVAL] (Clinical & Technical Gates)

[User] (1) ─────────────< [Study] (PrimaryDoctorID)
       (1) ─────────────< [SegmentationMask] (CreatedBy)
       (1) ─────────────< [Report] (SignedBy)
       (1) ─────────────< [ClinicalFeedback] (DoctorID)
       (1) ─────────────< [ConsultationMember] (UserID)
       (1) ─────────────< [AuditLog] (UserID)
```

### Table Definitions & Primary Columns:
- `DatasetSite`: `SiteID` (PK), `SiteCode`, `SiteName`, `SiteType` (Clinical_Deployment, Research_Source).
- `Scanner`: `ScannerID` (PK), `SiteID` (FK), `Vendor`, `ModelName`, `FieldStrength` (1.5T, 3.0T).
- `User`: `UserID` (PK), `Username`, `FullName`, `Role` (Radiologist, Neurologist, AI_Engineer, Admin), `Department`, `IsActive`.
- `Study`: `StudyID` (PK), `ScannerID` (FK), `PrimaryDoctorID` (FK -> User), `SubjectAnonymousID`, `Age`, `Gender`, `StrokeType`, `BaselineNIHSS`, `TimeFromOnset_Hours`, `PreStroke_mRS`, `QCStatus`, `QCDetails`, `CaseStatus` (Received, Processing, Failed, AwaitingReview, SignedOff).
- `Series`: `SeriesID` (PK), `StudyID` (FK), `StorageID` (FK -> Raw DICOM/NIfTI), `PreprocessedStorageID` (FK -> Co-registered volume), `SequenceType` (DWI, ADC, FLAIR), `EchoTime_TE`, `RepetitionTime_TR`, `PixelSpacing`, `SliceThickness`.
- `Model` & `ModelVersion`: `VersionID` (PK), `ModelID` (FK), `VersionTag`, `Architecture`, `InputModalities`, `WeightStorageID` (FK), `DeploymentStatus` (Active, Staging, Archived).
- `DomainAdaptationRun`: `RunID` (PK), `Source_VersionID` (FK), `Target_VersionID` (FK), `Source_SiteID` (FK), `Target_SiteID` (FK), `UDAMethod`, `BaselineTargetDice`, `AdaptedTargetDice`.
- `InferenceTask`: `TaskID` (PK), `StudyID` (FK), `VersionID` (FK), `ExecutionStatus`, `ExecutionTime_ms`, `ErrorMessage`.
- `SegmentationMask`: `MaskID` (PK), `StudyID` (FK), `TaskID` (FK), `VersionID` (FK), `ParentMaskID` (Self-FK for versioning), `StorageID` (FK), `MaskType` (AI_Prediction, Expert_GroundTruth, Consensus_Mask), `DiceScore`, `ApprovalStatus` (Pending, Accepted, Modified, Disputed).
- `LesionMeasurement`: `(MaskID, MeasurementNo)` (Composite PK), `TotalLesionVolume_mL`, `IschemicCore_mL`, `Penumbra_mL`, `Laterality`, `VascularTerritory`, `CoreAspectsScore`.
- `ClinicalFeedback`: `FeedbackID` (PK), `StudyID` (FK), `MaskID` (FK), `DoctorID` (FK -> Neurologist), `ClinicalUtilityRating`, `TreatmentDecision` (Thrombolysis, Thrombectomy, Conservative), `Comments`.
- `Consultationession`: `ConsultationID` (PK), `StudyID` (FK), `ConsensusMaskID` (FK -> Mask), `LeadChairID` (FK -> User), `TriggerReason`, `Status`, `ConsensusNotes`.
- `ConsultationMember`: `(ConsultationID, UserID)` (Composite PK), `IndividualMaskID` (FK -> Mask), `RoleInSession`, `AgreementWithAI`, `Comments`.
- `Report`: `ReportID` (PK), `StudyID` (FK), `ApprovedMaskID` (FK), `StorageID` (FK -> PDF), `SignedBy` (FK -> Radiologist), `ReportVersion`.
- `StorageObject`: `StorageID` (PK), `FileURL`, `FileType`, `FileSize`, `Location`.
- `AuditLog`: `LogID` (PK), `StudyID` (FK), `UserID` (FK), `Action`, `Timestamp`, `IP`, `PayloadSnapshot`.

---

## 7. Technology Stack & Key API Endpoints

### 7.1 Tech Stack
- **Frontend:** React SPA + **Cornerstone3D** (medical image stack/volume rendering, sync viewports, interactive contour drawing/editing tools).
- **Backend Framework:** **FastAPI (Python 3.11+)** with Pydantic typed contracts and async background tasks.
- **Imaging & AI Runtime:** PyTorch 2.x, SimpleITK, NiBabel, NumPy, SciPy (native-space volumetry, connected components).
- **Message Broker & Queue:** Celery / Redis / RabbitMQ (asynchronous DICOM validation & model inference).
- **Persistence:** PostgreSQL 16+ (relational metadata) + MinIO / AWS S3 (protected binary artifact storage).

### 7.2 Core API Endpoints
| HTTP Verb | Path | Auth Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Login with credentials, returns 15-min JWT. |
| `POST` | `/api/v1/auth/reauthenticate` | Radiologist | Step-up auth, returns 5-min sign-off token. |
| `GET` | `/api/v1/studies?status=awaiting_review` | Radiologist | Worklist of assigned cases awaiting review. |
| `GET` | `/api/v1/studies/{study_id}` | Authorized User | Fetch multimodal metadata, warnings, and measurements. |
| `GET` | `/api/v1/studies/{study_id}/artifacts/{id}` | Authorized User | Stream authenticated DICOM/NIfTI/Heatmap slices. |
| `POST` | `/api/v1/studies/{study_id}/mask-revisions` | Assigned Radiologist | Save edited contour; appends immutable revision; recomputes volume. |
| `POST` | `/api/v1/studies/{study_id}/sign-offs` | Assigned Radiologist | Final sign-off with step-up token, impression, and disposition. |
| `POST` | `/api/v1/studies/{study_id}/Report` | Radiologist / Neurologist | Generate & export versioned PDF report (stamped DRAFT if unsigned). |
| `GET` | `/api/v1/Report/{report_id}` | Neurologist / Radiologist | Download released clinical PDF report (403 if unapproved). |
| `POST` | `/api/v1/operations/suspension` | HoD / IT Admin | Emergency AI service circuit-breaker suspension. |
| `POST` | `/api/v1/model-versions/{id}/activation` | Dual Governance | Activate model requiring both Clinical & Technical approvals. |

---

## 8. Verification & Test Suite Guidelines (for AI QA Agents)

1. **Test Case TC-AUT:** Verify session timeout (15 min inactivity), role-based endpoint 403 blocks (Stroke Physician editing masks; IT Admin signing off cases), and step-up token enforcement.
2. **Test Case TC-QC:** Validate rejection of missing ADC/FLAIR sequences, non-conforming affine orientation (e.g., LPS instead of RAS), and singular matrices $\to$ Must trigger `Failed` state with `validation failed`.
3. **Test Case TC-MSK:** Golden-reference volumetry test. Synthetic 2000-voxel lesion at $2 \times 2 \times 4\,\text{mm}$ voxel spacing ($16\,\text{mm}^3/\text{voxel}$) must calculate exactly $32.000\,\text{mL}$ (tolerance $< 10^{-6}\,\text{mL}$).
4. **Test Case TC-RPT:** Ensure stroke physician cannot access or export any report where `CaseStatus != 'SignedOff'`. Verify draft PDF carries `DRAFT` watermark across all pages.
```

Tài liệu `UDA_StrokeSeg_Context.md` đã được khởi tạo hoàn chỉnh, trích xuất tất cả các thông tin then chốt từ báo cáo đồ án:
1. **Bối cảnh y khoa & AI (UDA):** Bản chất bài toán đột quỵ, sự dịch chuyển miền (Domain Shift) giữa các máy quét/bệnh viện, giải pháp UDA với Fourier Transfer, nnU-Net, Arterial Territories Atlas và SDF boundary mining.
2. **Ranh giới sản phẩm & Nghiệp vụ (Governance):** Cơ chế HITL (bác sĩ chẩn đoán hình ảnh duyệt/sửa) và HOTL (trưởng khoa & IT admin giám sát, ngắt khẩn cấp, duyệt model 2 lớp).
3. **Sơ đồ cơ sở dữ liệu & Thực thể (Database Schema):** Phẳng hóa các thông tin HIS, bổ sung đầy đủ các phân hệ `InferenceTask`, `SegmentationMask` (versioning), `LesionMeasurement`, `Consultationession` (hội chẩn), và `ClinicalFeedback`.
4. **Quy tắc máy trạng thái (State Machine):** Các điều kiện chuyển trạng thái nghiêm ngặt từ `Received` $\to$ `Processing` $\to$ `AwaitingReview` $\to$ `SignedOff`.
5. **Hợp đồng API & Bộ kiểm thử (Test Cases):** Ma trận endpoint RESTful và các ca kiểm thử chuẩn mực cho QA Agent.