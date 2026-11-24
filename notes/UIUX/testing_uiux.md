# Kế Hoạch & Kịch Bản Kiểm Thử Hệ Thống (Software Test Plan & Test Specifications)
## Dự án: UDA-StrokeSeg - Hệ Thống Hỗ Trợ Chẩn Đoán Đột Quỵ Nhồi Máu Não Cấp Tính Trên Ảnh MRI Đa Chuỗi Xung Đa Trung Tâm

---

## 1. TỔNG QUAN & CHIẾN LƯỢC KIỂM THỬ (TEST STRATEGY)

### 1.1 Mục tiêu kiểm thử
Tài liệu này xác định bộ kịch bản kiểm thử toàn diện (*Test Cases Specification*) cho hệ thống phần mềm y tế hỗ trợ ra quyết định lâm sàng **UDA-StrokeSeg**, bao gồm:
1. **Kiểm thử Luồng Giao diện & Trải nghiệm Người dùng (UI/UX Flows & Task-level Navigation):** Xác minh toàn bộ các bước tương tác trên sitemap đa tầng từ Màn hình Đăng nhập (Auth), Bàn làm việc CĐHA (Radiologist Workspace), Cổng bác sĩ lâm sàng (Stroke Physician Portal), Phòng hội chẩn đa chuyên khoa (Consultation Session), Bảng chỉ huy trưởng khoa (HoD Governance) đến Module Quản trị kỹ thuật (IT Administration).
2. **Kiểm thử Máy trạng thái & Ràng buộc Bất biến (State Machine & Invariants Validation):** Xác minh tính bất biến của ca bệnh sau khi ký duyệt (`SignedOff`), ngăn chặn tình trạng tự động duyệt (No Auto-Sign-off), và xử lý nghiêm ngặt các ca lỗi hình học/chất lượng (`Failed - validation failed`) hoặc vượt ngưỡng SLA (`Failed - processing failed`).
3. **Kiểm thử Ràng buộc Toàn vẹn Dữ liệu (ERD Integrity & Relational Verification):** Kiểm tra tính nhất quán giữa các bảng quan hệ trong PostgreSQL (quan hệ 1-N, N-N, thực thể yếu `ConsultationMember`, `LesionMeasurement`, liên kết đệ quy `ParentMaskID`, quan hệ thích ứng miền `DomainAdaptationRun`).
4. **Kiểm thử Kiến trúc Hướng Sự kiện (Event-Driven & Pub/Sub Circuit Breaker):** Kiểm thử luồng thông điệp từ tiếp nhận PACS (`Study Intake`), đẩy tác vụ phân tích bất đồng bộ, đồng hồ đếm ngược $180\,\text{s}$ SLA, cơ chế ngắt mạch tự động chuyển sang đọc thủ công (HOTL Manual Fallback), và cơ chế đồng bộ WebSocket thời gian thực.
5. **Kiểm thử Ma trận Phân quyền & An toàn Bảo mật (RBAC & Separation of Duties):** Đảm bảo tính phân định ranh giới nghiêm ngặt giữa Bác sĩ CĐHA, Bác sĩ điều trị, Trưởng khoa và Quản trị viên IT theo nguyên tắc *Deny by Default*.

### 1.2 Môi trường kiểm thử chuẩn (Test Environment)
* **Frontend:** React SPA, Cornerstone3D Viewer, WebSocket Client, HTML5 Web Audio API (Speech-to-Text).
* **Backend API Gateway:** FastAPI (Python 3.11+), JWT Authentication Middleware, Role-based Guardrails.
* **Message Broker / Pub/Sub:** Redis / RabbitMQ Event Bus.
* **Database & Storage:** PostgreSQL 16+ (Relational Metadata), MinIO / S3 Object Storage (DICOM/NIfTI blobs, signed PDFs).
* **AI Runtime:** PyTorch 2.x worker engine, SimpleITK.

---

## 2. MA TRẬN PHÂN QUYỀN TRUY CẬP (RBAC VERIFICATION MATRIX)

| Mã kiểm thử | Endpoint / Màn hình UI | Quyền thực hiện | Hành vi mong đợi cho Role hợp lệ | Hành vi mong đợi cho Role không hợp lệ |
| :--- | :--- | :--- | :--- | :--- |
| **RBAC-01** | `/radiologist/worklist` | `Radiologist` | Hiển thị worklist các ca chờ đọc (`AwaitingReview`). | Bị chặn, trả về mã lỗi `403 Forbidden`. |
| **RBAC-02** | `/radiologist/workspace/:id` (Vẽ/Sửa Mask) | `Radiologist` (Phân công) | Cho phép dùng Brush, Eraser, lưu bản Revision. | Chế độ chỉ đọc hoặc chặn truy cập `403 Forbidden`. |
| **RBAC-03** | `POST /api/v1/studies/:id/sign-offs` | `Radiologist` (Phân công) | Mở modal xác thực bước 2, ký duyệt chuyển `SignedOff`. | Tuyệt đối cấm; Stroke Physician, HoD, IT Admin đều bị chặn `403`. |
| **RBAC-04** | `/physician/cases/:id/treatment-plan` | `Stroke_Physician` | Cho phép tích chọn r-tPA, EVT, lưu phác đồ điều trị. | Radiologist, IT Admin chỉ có quyền xem hoặc bị chặn `403`. |
| **RBAC-05** | `POST /api/v1/operations/suspension` | `Head_Of_Dept`, `IT_Admin` | Kích hoạt cờ ngắt mạch toàn cục, chuyển sang `SUSPENDED`. | Radiologist, Stroke Physician bấm nút bị chặn `403`. |
| **RBAC-06** | `POST /api/v1/model-versions/:id/activation` | Cả `HoD` VÀ `IT_Admin` | Cần đủ 2 phê duyệt (Dual-Gate) mới kích hoạt model. | Một tác nhân đơn lẻ tự kích hoạt sẽ nhận lỗi `400 Bad Request`. |
| **RBAC-07** | `/admin/telemetry-events/audit-logs` | `IT_Admin` | Truy cập nhật ký kiểm toán bất biến, xem JSON payload. | Các nhân viên y tế lâm sàng bị từ chối truy cập `403`. |

---

## 3. KỊCH BẢN KIỂM THỬ LUỒNG NGHIỆP VỤ (UI & WORKFLOW TEST SPECIFICATIONS)

### 3.1 Nhóm Kiểm thử FLOW 0: Xác thực, Phiên làm việc & Bảo mật (Authentication & Session)

#### TC-AUTH-01: Đăng nhập thành công và Phân hướng theo Vai trò (Role-Based Redirect)
* **Mục tiêu:** Xác minh quá trình đăng nhập cấp phát đúng JWT Token và điều hướng đúng Workspace chuyên môn.
* **Dữ liệu đầu vào:**
  * User A: `rad_user01` / `Pass@123` (Role: `Radiologist`).
  * User B: `phys_user01` / `Pass@123` (Role: `Stroke_Physician`).
  * User C: `hod_user01` / `Pass@123` (Role: `Head_Of_Department`).
  * User D: `admin_user01` / `Pass@123` (Role: `IT_Administrator`).
* **Các bước thực hiện:**
  1. Truy cập URL `/auth/login`.
  2. Nhập thông tin đăng nhập tương ứng của từng người dùng.
  3. Nhấn nút `[Sign In]`.
* **Kết quả mong đợi:**
  * Xác thực thành công: Nhận JWT Bearer Token có thời hạn $900\,\text{s}$ ($15\,\text{phút}$).
  * Điều hướng tự động:
    * User A $\to$ `/radiologist/worklist/emergency`.
    * User B $\to$ `/physician/dashboard`.
    * User C $\to$ `/governance/clinical-overview`.
    * User D $\to$ `/admin/telemetry-events/event-bus`.
  * Cơ sở dữ liệu: Sinh một bản ghi mới trong bảng `AuditLog` với `Action = 'LOGIN'`, lưu kèm IP và User-Agent.

#### TC-AUTH-02: Khóa phiên làm việc tự động sau 15 phút không tương tác (Idle Timeout)
* **Mục tiêu:** Xác minh màn hình tự động làm mờ và khóa phiên khi không có thao tác bàn phím/chuột.
* **Tiền điều kiện:** Người dùng đang đăng nhập tại bất kỳ màn hình nào (không thuộc hàng đợi cấp cứu).
* **Các bước thực hiện:**
  1. Để nguyên giao diện không phát sinh tương tác chuột/bàn phím trong $15\,\text{phút}$.
* **Kết quả mong đợi:**
  * Màn hình overlay làm mờ kích hoạt (`/auth/session-lock`).
  * Dữ liệu y tế nhạy cảm bị che giấu hoàn toàn.
  * Hiển thị ô nhập mật khẩu/mã PIN để mở khóa lại phiên.
  * Nếu sau thêm $5\,\text{phút}$ không mở khóa $\to$ Hủy token và điều hướng về `/auth/login`.

#### TC-AUTH-03: Cơ chế Miễn trừ Khóa phiên khi Đang đọc Ca Cấp cứu (Emergency Bypass)
* **Mục tiêu:** Đảm bảo bác sĩ không bị ngắt quãng khi đang mở xem ca bệnh đột quỵ cấp cứu khẩn cấp.
* **Tiền điều kiện:** Bác sĩ CĐHA đang mở Workspace một ca chụp có cờ `IsEmergency = True` hoặc đang trong thời gian $180\,\text{s}$ SLA.
* **Các bước thực hiện:**
  1. Để nguyên màn hình không di chuột trong hơn $15\,\text{phút}$.
* **Kết quả mong đợi:**
  * Hệ thống phát hiện ca cấp cứu đang mở và tự động kích hoạt cơ chế Keep-Alive.
  * Màn hình không bị khóa; xuất hiện banner cảnh báo màu vàng: *"Ca cấp cứu đang kích hoạt - Cơ chế khóa phiên tự động tạm thời được hoãn"*.

---

### 3.2 Nhóm Kiểm thử FLOW 1: Bác sĩ Chẩn đoán hình ảnh (Radiologist Workspace)

#### TC-RAD-01: Giám sát Hàng đợi Cấp cứu và Đếm ngược SLA 180s thời gian thực
* **Mục tiêu:** Xác minh Worklist cấp cứu hiển thị chính xác bộ đếm thời gian thực và cảnh báo màu.
* **Tiền điều kiện:** PACS vừa đẩy ca chụp mới hợp lệ lên hệ thống; hệ thống bắt đầu chạy suy luận AI.
* **Các bước thực hiện:**
  1. Bác sĩ CĐHA truy cập `/radiologist/worklist/emergency`.
  2. Quan sát hàng đợi ca bệnh vừa tiếp nhận.
* **Kết quả mong đợi:**
  * Ca bệnh hiển thị huy hiệu cấp cứu đỏ nhấp nháy, đi kèm các thông số: `AccessionNo`, `SymptomOnsetTime`, `TimeFromOnset_Hours`.
  * Thanh đếm ngược thời gian $180\,\text{s}$ SLA hoạt động giật lùi qua WebSocket:
    * Thời gian $> 60\,\text{s}$: Màu xanh lá.
    * Thời gian $30\,\text{s} - 60\,\text{s}$: Màu vàng cam.
    * Thời gian $< 30\,\text{s}$: Màu đỏ cảnh báo.
  * Khi AI hoàn tất trước $180\,\text{s}$: Trạng thái đổi thành `AwaitingReview`, nút `[Vào đọc ca]` sáng lên.

#### TC-RAD-02: Đồng bộ Khung nhìn Đa chuỗi xung (Synchronized Multi-slice Scrolling)
* **Mục tiêu:** Kiểm tra tính năng đồng bộ lát cắt giữa các chuỗi xung DWI, ADC và FLAIR trong Workspace.
* **Tiền điều kiện:** Mở một ca bệnh tại `/radiologist/workspace/:study_id`.
* **Các bước thực hiện:**
  1. Đặt con trỏ chuột vào khung nhìn chuỗi xung DWI.
  2. Dùng con lăn cuộn từ lát cắt $z = 10$ đến lát cắt $z = 25$.
  3. Nhấn phím cách (`Spacebar`).
* **Kết quả mong đợi:**
  * Khung nhìn của chuỗi xung ADC và FLAIR tự động cuộn lát cắt đồng bộ chính xác theo trục $z$ của DWI.
  * Khi nhấn `Spacebar`, lớp phủ `SegmentationMask` màu đỏ bán trong suốt do AI dự đoán lập tức ẩn/hiện mượt mà trên cả 3 khung nhìn.
  * Con trỏ chuột chữ thập (Crosshair) hiển thị chính xác tọa độ vật lý 3D $(x, y, z)$ tính theo `VoxelSpacing` và `AffineMatrix` của `Series`.

#### TC-RAD-03: Chỉnh sửa Mask Thủ công (Human-in-the-Loop Revision) & Tự động Tính lại Thể tích
* **Mục tiêu:** Xác minh chức năng vẽ sửa viền tổn thương tạo ra bản ghi revision mới và cập nhật đúng số đo thể tích.
* **Tiền điều kiện:** Ca bệnh đang ở trạng thái `AwaitingReview` với mask AI ban đầu có thể tích $V_1 = 20.0\,\text{mL}$.
* **Các bước thực hiện:**
  1. Chọn công cụ `[Brush Tool]` trên thanh Interactive Segmentation Studio.
  2. Vẽ thêm một vùng tổn thương trên 2 lát cắt liên tiếp.
  3. Nhấn nút `[Lưu bản chỉnh sửa]`.
  4. Nhập lý do điều chỉnh: *"Bổ sung ổ tổn thương nhỏ vùng vỏ não thùy đảo"*.
* **Kết quả mong đợi:**
  * Client gửi yêu cầu `POST /api/v1/studies/{id}/mask-revisions`.
  * Cơ sở dữ liệu:
    * Bản ghi `SegmentationMask` gốc của AI giữ nguyên vẹn (`MaskType = 'AI_Prediction'`).
    * Tạo một bản ghi `SegmentationMask` mới với `ParentMaskID = MaskID_gốc`, `MaskType = 'Expert_GroundTruth'`.
    * Bảng `LesionMeasurement` mới được sinh ra với thể tích tăng lên tương ứng ($V_2 > 20.0\,\text{mL}$).
  * Trên giao diện: Thẻ chỉ số `LesionVolume` lập tức cập nhật giá trị mới; hiển thị huy hiệu `Revision 2`.

#### TC-RAD-04: Xử lý Mặt nạ Dự đoán Rỗng (Empty Mask Warning)
* **Mục tiêu:** Đảm bảo hệ thống cảnh báo đúng mức khi AI không tìm thấy tổn thương ($0.0\,\text{mL}$).
* **Tiền điều kiện:** AI inference hoàn tất với kết quả mask không có voxel dương tính ($0\,\text{voxel}$).
* **Các bước thực hiện:**
  1. Bác sĩ mở ca bệnh có kết quả rỗng.
* **Kết quả mong đợi:**
  * Trạng thái ca bệnh vẫn là `AwaitingReview` (không được tự ý kết luận âm tính).
  * Panel số liệu hiển thị `TotalLesionVolume = 0.000 mL`.
  * Xuất hiện hộp cảnh báo viền vàng bắt buộc: *"Mặt nạ rỗng là kết quả của model, KHÔNG PHẢI bằng chứng loại trừ đột quỵ. Yêu cầu bác sĩ rà soát toàn bộ lát cắt"*.
  * Bác sĩ vẫn có toàn quyền dùng `[Brush Tool]` để tự vẽ vùng tổn thương nếu phát hiện AI bỏ sót.

#### TC-RAD-05: Thu âm Nhận định Lâm sàng bằng Giọng nói (Ambient Voice Dictation)
* **Mục tiêu:** Kiểm tra tính năng chuyển đổi giọng nói thành văn bản thời gian thực.
* **Các bước thực hiện:**
  1. Bấm vào biểu tượng `[Microphone]` trong phân vùng Diagnostic Reporting Studio.
  2. Bác sĩ đọc câu: *"Ghi nhận nhồi máu não cấp bán cầu trái vùng cấp máu động mạch não giữa MCA thể tích ba mươi tư mililit"*.
  3. Nhấn `[Tự động điền số liệu]`.
* **Kết quả mong đợi:**
  * Khung text `Diagnostic Impression` hiển thị đúng văn bản được nhận dạng.
  * Các số liệu định lượng từ `LesionMeasurement` tự động chèn vào trường văn bản chuẩn hóa.

#### TC-RAD-06: Khảo sát Phản hồi Chất lượng AI & Ký duyệt Báo cáo (Sign-off)
* **Mục tiêu:** Xác minh quy trình đánh giá AI và ký duyệt điện tử bước hai để đóng băng ca bệnh.
* **Tiền điều kiện:** Bác sĩ CĐHA đã hoàn thành đọc ảnh và nhập nhận định chẩn đoán.
* **Các bước thực hiện:**
  1. Nhấn nút `[Hoàn tất đọc ca]`.
  2. Trên Modal Feedback: Chọn Perceived Dice Score = *"Tốt"*, Clinical Utility Rating = `5 sao`, bấm `[Gửi phản hồi & Tiếp tục Ký duyệt]`.
  3. Trên Modal Sign-off: Xem bản PDF preview (đang có watermark mờ `DRAFT`).
  4. Nhập mật khẩu xác thực bước hai (Step-up PIN) và bấm `[Ký duyệt Báo cáo]`.
* **Kết quả mong đợi:**
  * Gửi yêu cầu `POST /api/v1/studies/{id}/sign-offs`.
  * Cơ sở dữ liệu:
    * Bản ghi `ClinicalFeedback` được lưu với `ClinicalUtilityRating = 5`.
    * Ca bệnh chuyển trạng thái `CaseStatus = 'SignedOff'`.
    * Bảng `Report` được lưu với `SignedBy = UserID` của bác sĩ, sinh mã `ReportVersion`.
    * Cờ `SegmentationMask.ApprovalStatus` cập nhật thành `Accepted`.
  * File PDF chính thức được lưu vào `StorageObject`, xóa hoàn toàn chữ `DRAFT`, đóng dấu chữ ký số điện tử.
  * Ca bệnh chuyển sang trạng thái bất biến: Toàn bộ công cụ vẽ Brush/Eraser bị khóa; không thể chỉnh sửa hay ký lại.

---

### 3.3 Nhóm Kiểm thử FLOW 2: Bác sĩ Điều trị Đột quỵ (Stroke Physician Portal)

#### TC-PHY-01: Ngăn chặn Truy cập Ca bệnh Chưa Ký duyệt (Draft Access Guardrail)
* **Mục tiêu:** Đảm bảo bác sĩ điều trị lâm sàng tuyệt đối không xem được kết quả nháp hoặc ca bệnh chưa hoàn tất đọc CĐHA.
* **Tiền điều kiện:** Ca bệnh $X$ đang ở trạng thái `Processing` hoặc `AwaitingReview`.
* **Các bước thực hiện:**
  1. Bác sĩ lâm sàng đăng nhập vào `/physician/cases`.
  2. Cố tình nhấn vào ca bệnh $X$ hoặc nhập trực tiếp URL `/physician/cases/{X_id}`.
* **Kết quả mong đợi:**
  * Hệ thống chặn hiển thị màn hình phân tích hình ảnh và kết quả AI.
  * Hiển thị thông báo trạng thái: *"Ca chụp đang trong quá trình phân tích hoặc chờ Bác sĩ CĐHA ký duyệt chính thức"*.
  * Tuyệt đối không xuất hiện nút tải PDF hoặc xem trước lát cắt có mask nháp.

#### TC-PHY-02: Xem Kết quả Hình ảnh Ký duyệt & Đánh giá Phác đồ Can thiệp (r-tPA / EVT)
* **Mục tiêu:** Xác minh bác sĩ lâm sàng tiếp nhận đầy đủ thông số đã duyệt để ra quyết định điều trị.
* **Tiền điều kiện:** Ca bệnh $Y$ đã được ký duyệt (`CaseStatus = 'SignedOff'`).
* **Các bước thực hiện:**
  1. Bác sĩ điều trị mở ca bệnh $Y$ tại `/physician/cases/{Y_id}`.
  2. Chuyển sang tab `/treatment-plan`.
  3. Kiểm tra các tiêu chuẩn: Thời gian khởi phát $< 4.5\,\text{h}$, không có chống chỉ định xuất huyết.
  4. Tích chọn `[Chỉ định Tiêu sợi huyết r-tPA]`.
  5. Chọn `TreatmentDecision = 'Thrombolysis'`.
  6. Nhấn `[Lưu phác đồ điều trị]`.
* **Kết quả mong đợi:**
  * Màn hình hiển thị đúng `ApprovedMask` và các chỉ số thể tích tổn thương do Radiologist đã ký.
  * Phác đồ can thiệp được lưu vào bảng `ClinicalFeedback` gắn với ca bệnh.
  * Cho phép bấm `[Tải Báo cáo Y khoa Chính thức (Signed PDF)]` để tải về bản PDF chuẩn có chữ ký số.

---

### 3.4 Nhóm Kiểm thử FLOW 3: Hội chẩn Đa chuyên khoa (Multi-Disciplinary Consultation)

#### TC-CON-01: Khởi tạo Phiên Hội chẩn & Đồng bộ Canvas Nhiều Người Dùng
* **Mục tiêu:** Kiểm tra khả năng tạo phòng hội chẩn trực tuyến và đồng bộ thao tác giữa các bác sĩ.
* **Tiền điều kiện:** Ca bệnh phức tạp cần ý kiến đa khoa.
* **Các bước thực hiện:**
  1. Bác sĩ điều trị bấm `[Yêu cầu Triệu tập Hội chẩn Khẩn cấp]` $\to$ Nhập lý do: *"Mismatch lâm sàng - hình ảnh không tương thích, nguy cơ xuất huyết cao"*.
  2. Bác sĩ CĐHA (vai trò Member) và Trưởng khoa (vai trò Chair) cùng truy cập vào `Consultation/session/:consultation_id`.
  3. Bác sĩ Chủ tọa (Chair) phóng to vùng tổn thương trên ảnh DWI và cuộn lát cắt.
* **Kết quả mong đợi:**
  * Cơ sở dữ liệu: Sinh bản ghi `Consultationession` với `TriggerReason` tương ứng; bảng `ConsultationMember` ghi nhận đầy đủ các bác sĩ tham gia kèm vai trò `Chair`, `Member`.
  * Trên Canvas: Vị trí con trỏ chuột của từng bác sĩ hiển thị kèm tên; thao tác phóng to và cuộn lát cắt của Chủ tọa được đồng bộ thời gian thực qua WebSocket đến màn hình của tất cả thành viên khác.

#### TC-CON-02: Biểu quyết Ý kiến Đồng thuận & Ký Biên bản Hội chẩn
* **Mục tiêu:** Xác minh quy trình bỏ phiếu biểu quyết và ký biên bản đồng thuận cuối cùng.
* **Các bước thực hiện:**
  1. Từng thành viên hội đồng tích chọn biểu quyết trên panel: Chọn `AgreementWithAI = 'Agree'` hoặc `'Disagree'`.
  2. Thư ký ghi chép tóm tắt diễn tiến vào ô `ConsensusNotes`.
  3. Chủ tọa nhấn `[Ký duyệt Đồng thuận Hội chẩn]` $\to$ Nhập mã xác thực bước hai.
* **Kết quả mong đợi:**
  * Từng phiếu biểu quyết được ghi vào `ConsultationMember.AgreementWithAI`.
  * Cập nhật `Consultationession.Status = 'FINALIZED'`, lưu `ConsensusNotes`.
  * Biên bản kết luận hội chẩn tự động đồng bộ sang hồ sơ bệnh án của Bác sĩ điều trị tại FLOW 2.

---

### 3.5 Nhóm Kiểm thử FLOW 4: Giám sát Chỉ huy của Trưởng khoa (HoD Governance & SLA)

#### TC-GOV-01: Giám sát SLA 180s & Điều phối Khẩn cấp Ca Quá hạn (Manual Fallback Reassignment)
* **Mục tiêu:** Kiểm tra khả năng phát hiện ca vượt ngưỡng SLA và điều phối cưỡng bức ca bệnh.
* **Tiền điều kiện:** Một ca chụp gặp sự cố worker AI chạy quá $180\,\text{s}$ dẫn đến ngắt mạch Circuit Breaker.
* **Các bước thực hiện:**
  1. Trưởng khoa mở `/governance/sla-monitor`.
  2. Kiểm tra danh sách tại mục `Emergency Fallback Queue (>180s Timeout)`.
  3. Nhấn nút `[Điều phối khẩn (Reassign)]` trên ca bệnh bị quá hạn.
  4. Chọn Bác sĩ CĐHA trực thay thế từ danh sách Reviewer Roster và bấm `[Xác nhận Chuyển ca]`.
* **Kết quả mong đợi:**
  * Ca bệnh quá hạn hiển thị viền đỏ cảnh báo vi phạm SLA $180\,\text{s}$.
  * Thao tác điều phối cập nhật lại `PrimaryDoctorID` của ca bệnh sang bác sĩ mới.
  * Worklist của bác sĩ mới lập tức nhận thông báo đẩy qua WebSocket yêu cầu đọc thủ công khẩn cấp.

#### TC-GOV-02: Tạm dừng Khẩn cấp Dịch vụ AI (Circuit Breaker AI Suspension)
* **Mục tiêu:** Xác minh chức năng ngắt mạch dừng toàn bộ hệ thống AI khi phát hiện nguy cơ sai lệch lâm sàng.
* **Các bước thực hiện:**
  1. Trưởng khoa nhấn nút `[Ngắt mạch Khẩn cấp Dịch vụ AI (Suspend AI Service)]`.
  2. Nhập lý do bắt buộc: *"Phát hiện tỷ lệ dương tính giả bất thường trên scanner 1.5T mới tiếp nhận"*.
  3. Bấm `[Xác nhận Dừng Dịch vụ]`.
* **Kết quả mong đợi:**
  * Gửi yêu cầu `POST /api/v1/operations/suspension`.
  * Trạng thái toàn cục chuyển sang `SUSPENDED`.
  * Mọi ca chụp mới từ PACS đẩy vào sẽ tự động gắn cờ `Manual Reading`, không đưa vào worker AI inference.
  * Biểu tượng trạng thái trên thanh điều hướng toàn hệ thống chuyển sang màu cam nhấp nháy: *"AI Service Suspended by Clinical Governance"*.

---

### 3.6 Nhóm Kiểm thử FLOW 5: Quản trị Hệ thống & MLOps (IT Administrator)

#### TC-ADM-01: Quy trình Kích hoạt Mô hình AI Hai Lớp Duyệt (Dual-Authorization Gate)
* **Mục tiêu:** Xác minh mô hình AI mới không thể được kích hoạt nếu thiếu một trong hai phê duyệt (Lâm sàng hoặc Kỹ thuật).
* **Tiền điều kiện:** Phiên bản mô hình mới `UDA-StrokeSeg-v2.1` vừa được import với trạng thái ban đầu `INACTIVE`.
* **Các bước thực hiện:**
  1. IT Administrator nhấn `[Kích hoạt Model (Deploy Active)]` khi chưa có phê duyệt lâm sàng.
  2. Trưởng khoa đăng nhập và thực hiện phê duyệt lâm sàng (`Clinical Gate Approved`).
  3. IT Administrator đăng nhập, thực hiện phê duyệt kỹ thuật (`Technical Gate Approved`) và bấm `[Kích hoạt Model (Deploy Active)]`.
* **Kết quả mong đợi:**
  * Tại Bước 1: Hệ thống trả về lỗi `400 Bad Request` với thông báo: *"Yêu cầu bắt buộc phải có đầy đủ phê duyệt từ cả Trưởng khoa lâm sàng và Quản trị viên kỹ thuật"*.
  * Tại Bước 3: Sau khi cả hai cổng đều duyệt thành công, model chuyển trạng thái `DeploymentStatus = 'Active'`.
  * AI Worker tải trọng số mới vào bộ nhớ GPU (Hot Reload); ghi vết kiểm toán `MODEL_ACTIVATED`.

#### TC-ADM-02: Xử lý Ca chụp Lỗi Cách ly (Quarantine Log Inspection)
* **Mục tiêu:** Kiểm tra kho lưu trữ các ca chụp bị từ chối từ cổng tiếp nhận PACS.
* **Tiền điều kiện:** PACS gửi một ca chụp thiếu chuỗi xung FLAIR.
* **Các bước thực hiện:**
  1. IT Admin truy cập `/admin/telemetry-events/quarantine-logs`.
  2. Bấm xem chi tiết ca chụp bị cách ly mới nhất.
* **Kết quả mong đợi:**
  * Hiển thị mã lỗi `Reason = 'Missing mandatory sequence: FLAIR'`.
  * Xem được chi tiết siêu dữ liệu DICOM Header và thời điểm nhận file.
  * Nút `[Yêu cầu KTV Chụp lại]` gửi thông báo phản hồi mã lỗi DICOM `0xC000` về trạm làm việc PACS.

#### TC-ADM-03: Kiểm tra Tính Bất biến của Nhật ký Kiểm toán (Immutable Audit Trail)
* **Mục tiêu:** Đảm bảo mọi thao tác quan trọng đều được ghi vết và không thể bị chỉnh sửa/xóa.
* **Các bước thực hiện:**
  1. IT Admin truy cập `/admin/telemetry-events/audit-logs`.
  2. Lọc theo mã ca bệnh đã ký duyệt ở TC-RAD-06.
  3. Kiểm tra tính toàn vẹn của JSON Payload.
  4. Cố tình gửi lệnh API `DELETE /api/v1/audit-logs/:id`.
* **Kết quả mong đợi:**
  * Nhật ký hiển thị đầy đủ chuỗi hành động theo trình tự thời gian: `RECEIVED` $\to$ `VALIDATED` $\to$ `INFERENCE_COMPLETED` $\to$ `MASK_REVISED` $\to$ `REPORT_SIGNED`.
  * Ghi nhận chính xác địa chỉ IP, UserID và Device của người thực hiện.
  * Lệnh xóa bị máy chủ từ chối thẳng thừng với mã lỗi `405 Method Not Allowed` (Audit Log là bảng chỉ ghi Append-only).

---

## 4. BỘ KIỂM THỬ THUẬT TOÁN ĐO ĐẠC THỂ TÍCH (ALGORITHMIC QUANTIFICATION TEST)

```
+-----------------------------------------------------------------------------------------+
|                                TC-ALG-VOLUMETRY: TEST CASE VÀNG                        |
+-----------------------------------------------------------------------------------------+
|  Dữ liệu giả lập (Synthetic Matrix):                                                    |
|  - Kích thước không gian (Grid Size): 128 x 128 x 32 voxels                             |
|  - Độ phân giải voxel (Voxel Spacing): 2.0 mm x 2.0 mm x 4.0 mm                         |
|  - Thể tích 1 voxel (Voxel Volume): 2.0 * 2.0 * 4.0 = 16.0 mm³ = 0.016 mL               |
|                                                                                         |
|  Kịch bản gán nhãn:                                                                     |
|  - Gán nhãn 1 (Lesion) cho đúng 2,000 voxels liên thông tạo thành 1 khối cầu trung tâm  |
|                                                                                         |
|  Công thức tính toán trong không gian gốc (Native Space):                               |
|                     V = (Số lượng voxel * Voxel Volume) / 1000                          |
|                     V = (2,000 * 16.0 mm³) / 1000 = 32.000 mL                           |
|                                                                                         |
|  Tiêu chí nghiệm thu (Tolerance):                                                       |
|  - Thể tích báo cáo hiển thị: Chính xác 32.000 mL (Sai số cho phép < 10^-6 mL).          |
|  - Số lượng ổ tổn thương (Cluster Count): Chính xác 1 ổ.                                |
|  - Trục tọa độ tâm tổn thương: Khớp chính xác với tâm khối cầu giả lập.                 |
+-----------------------------------------------------------------------------------------+
```

---

## 5. MẪU BÁO CÁO KẾT QUẢ KIỂM THỬ (TEST EXECUTION LOG TEMPLATE)

```markdown
# Test Execution Run Report
* **Mã đợt kiểm thử:** TR-20261109-UDA-CORE
* **Phiên bản phần mềm:** UDA-StrokeSeg v2.1.0-rc3
* **Người thực hiện:** QA Engineering Team / Clinical Testing Lead
* **Ngày thực hiện:** 09/11/2026

| Mã Test Case | Phân hệ kiểm thử | Kết quả (Pass/Fail) | Thời gian phản hồi | Ghi chú & Mã Log phát sinh |
| :--- | :--- | :---: | :---: | :--- |
| **TC-AUTH-01** | Gateway Authentication | PASS | 120 ms | JWT sinh đúng claims, RBAC redirect chuẩn. |
| **TC-AUTH-02** | Idle Session Timeout | PASS | 15 min | Màn hình mờ đúng 15:00, PIN unlock thành công. |
| **TC-AUTH-03** | Emergency Bypass | PASS | -- | Giữ phiên liên tục khi mở ca đột quỵ cấp. |
| **TC-RAD-01** | Worklist SLA Timer | PASS | Realtime WS | Đồng hồ đếm ngược mượt mà, cảnh báo đổi màu đúng. |
| **TC-RAD-02** | Synchronized Viewer | PASS | 60 fps | Lát cắt cuộn mượt, phím Space toggle mask tức thì. |
| **TC-RAD-03** | HITL Mask Revision | PASS | 450 ms | Sinh revision mới, ParentMaskID chuẩn, tính lại thể tích. |
| **TC-RAD-04** | Empty Mask Warning | PASS | 80 ms | Hiển thị hộp cảnh báo vàng bắt buộc đọc lát cắt. |
| **TC-RAD-05** | Voice Dictation (STT) | PASS | 310 ms | Chuyển văn bản chính xác, auto-fill metric chuẩn. |
| **TC-RAD-06** | Sign-off & Lock Case | PASS | 650 ms | Đóng băng ca bệnh, ký số PDF, đẩy event StudyValidated. |
| **TC-PHY-01** | Draft Access Guardrail | PASS | 40 ms | Chặn truy cập ca chưa ký, chống lọt kết quả nháp. |
| **TC-PHY-02** | Treatment Decision Plan | PASS | 190 ms | Lưu phác đồ r-tPA, tải PDF signed thành công. |
| **TC-CON-01** | Multi-Doctor Canvas | PASS | Realtime WS | Đồng bộ con trỏ chuột, chia sẻ zoom/pan mượt mà. |
| **TC-CON-02** | Consensus Sign-off | PASS | 520 ms | Lưu biên bản đồng thuận, cập nhật bệnh án. |
| **TC-GOV-01** | 180s SLA Reassignment | PASS | 210 ms | Bắt trúng ca quá hạn, điều phối lại bác sĩ thành công. |
| **TC-GOV-02** | Circuit Breaker Suspend | PASS | 95 ms | Chuyển toàn cục sang SUSPENDED, bypass AI an toàn. |
| **TC-ADM-01** | Dual-Gate Deployment | PASS | 140 ms | Chặn kích hoạt đơn phương, duyệt kép thành công. |
| **TC-ADM-02** | Quarantine Log Manager | PASS | 110 ms | Bắt trúng ca thiếu xung FLAIR, bắn lỗi DICOM 0xC000. |
| **TC-ADM-03** | Immutable Audit Trail | PASS | 75 ms | Chặn lệnh DELETE, lưu vết IP/User-Agent toàn vẹn. |
| **TC-ALG-01** | Native Volumetry Test | PASS | 15 ms | Tính đúng 32.000 mL sai số 0.000000 mL. |
```