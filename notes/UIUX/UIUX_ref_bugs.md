# 57 Lỗi UX/UI Website Thường Gặp và Cách Sửa

* **Tác giả:** Hoa Trần (Markdao)
* **Chủ đề:** Website Design & UX/UI Usability
* **Tiêu chuẩn tham chiếu:** Nielsen Norman Group (NN/g), Baymard Institute, Laws of UX (Jon Yablonski), WCAG 2.2, Google Core Web Vitals.

---

## Mục lục
1. [Lỗi Navigation & Information Architecture](#1-lỗi-navigation--information-architecture)
2. [Lỗi Forms & Input Fields](#2-lỗi-forms--input-fields)
3. [Lỗi Checkout & Luồng chuyển đổi](#3-lỗi-checkout--luồng-chuyển-đổi-trên-website)
4. [Lỗi CTA & Buttons](#4-lỗi-cta--buttons)
5. [Lỗi Visual Hierarchy & Layout](#5-lỗi-visual-hierarchy--layout)
6. [Lỗi Mobile & Responsive](#6-lỗi-mobile--responsive)
7. [Lỗi Performance & Loading](#7-lỗi-performance--loading)
8. [Lỗi Trust & Transparency (Minh bạch & Tin cậy)](#8-lỗi-trust--transparency)
9. [Lỗi Feedback & System Status](#9-lỗi-feedback--system-status)
10. [Lỗi Error Handling & Recovery](#10-lỗi-error-handling--recovery)
11. [Lỗi Search & Filter](#11-lỗi-search--filter)
12. [Lỗi Accessibility](#12-lỗi-accessibility)
13. [Lỗi Content & Microcopy](#13-lỗi-content--microcopy)
14. [Lỗi Onboarding & Empty States](#14-lỗi-onboarding--empty-states)
15. [Lỗi Dark Patterns](#15-lỗi-dark-patterns)
16. [Cách ưu tiên lỗi UX/UI (Framework P0 - P3)](#cách-ưu-tiên-lỗi-uxui-website)
17. [Quy trình audit UX/UI website trong 90 phút](#quy-trình-audit-uxui-website-trong-90-phút)
18. [Mối liên hệ giữa UX/UI và SEO](#uxui-ảnh-hưởng-đến-seo-như-thế-nào)

---

## 1. Lỗi Navigation & Information Architecture

### 1.1 Menu cấp 1 có quá nhiều mục
* **Nguyên lý:** Vi phạm Định luật Hick (Hick’s Law) – thời gian ra quyết định tăng theo cấp số nhân khi số lượng lựa chọn tăng.
* **Dấu hiệu:** Menu chính dàn trải, nhiều mục chồng chéo ý nghĩa, nội dung quan trọng bị chìm.
* **Tác động:** Tăng tải nhận thức (cognitive load), người dùng mất phương hướng khi quét màn hình.
* **Cách sửa:** Giới hạn khoảng **5–7 nhóm điều hướng chính** ở cấp 1. Chuyển các mục chi tiết vào dropdown hoặc mega-menu có nhóm logic rõ ràng.
* **Mốc kiểm tra:** User trả lời ngay được: *"Tôi cần tìm gì và nên bấm vào đâu?"*

### 1.2 Information Architecture (IA) phản ánh cơ cấu tổ chức nội bộ
* **Nguyên lý:** Vi phạm nguyên tắc NN/g: *Match Between System and the Real World*.
* **Dấu hiệu:** Menu phân chia theo phòng ban, dùng mã dự án hoặc thuật ngữ nội bộ.
* **Tác động:** Buộc khách hàng phải hiểu cách vận hành của doanh nghiệp mới tìm được dịch vụ.
* **Cách sửa:** Tổ chức sitemap dựa trên nhu cầu, hành trình của khách hàng. Thực hiện kiểm chứng bằng phương pháp **Card Sorting** với đối tượng mục tiêu.
* **Mốc kiểm tra:** User tìm đúng thông tin dựa trên nhu cầu cá nhân mà không cần biết cấu trúc phòng ban phụ trách.

### 1.3 Website nhiều tầng nhưng thiếu Breadcrumb
* **Dấu hiệu:** Trang sâu từ cấp 2 trở lên nhưng không hiển thị vị trí hiện tại trong cây thư mục.
* **Tác động:** Khó định vị *"Tôi đang ở đâu?"*, tốn thao tác back hoặc bấm lại menu cha.
* **Cách sửa:** Bổ sung Breadcrumb có cấu trúc rõ: `Trang chủ > Danh mục cha > Danh mục con > Trang hiện tại`.
* **Mốc kiểm tra:** Nhìn vào breadcrumb định vị được vị trí và có thể nhảy nhanh về bất kỳ cấp cha nào.

### 1.4 Nút Back làm mất trạng thái đã nhập (State Loss)
* **Dấu hiệu:** Nhấn nút Back trên trình duyệt làm reset trắng form hoặc mất toàn bộ bộ lọc đã chọn.
* **Tác động:** Phá vỡ cảm giác kiểm soát (User Control and Freedom), gây nản lòng và bỏ dở tác vụ.
* **Cách sửa:** Quản lý page state và browser history đúng cách, tránh reload về trạng thái mặc định ban đầu.
* **Mốc kiểm tra:** Chọn bộ lọc $\rightarrow$ chuyển trang $\rightarrow$ bấm Back $\rightarrow$ bộ lọc và vị trí cuộn vẫn giữ nguyên.

### 1.5 Label menu dùng thuật ngữ nội bộ, mơ hồ
* **Dấu hiệu:** Đặt tên menu trừu tượng, viết tắt, không phản ánh đúng nội dung trang đích.
* **Cách sửa:** Sử dụng ngôn ngữ đại chúng, rõ ràng. Test nhãn bằng câu hỏi: *"Bạn nghĩ trang này sẽ mở ra cái gì?"* trước khi publish.

---

## 2. Lỗi Forms & Input Fields

### 2.1 Định dạng ngày hết hạn thẻ không khớp thẻ vật lý
* **Dấu hiệu:** Thẻ ngân hàng in `MM/YY` nhưng hệ thống bắt nhập `MM/YYYY` hoặc ngược lại.
* **Tác động:** Tạo ma sát tinh thần, khiến người dùng dễ nhập sai thông tin thanh toán.
* **Cách sửa:** Thiết kế định dạng trường khớp với thẻ vật lý (`MM/YY`) hoặc cấu hình hệ thống tự động chuẩn hóa định dạng.

### 2.2 Bố cục Form nhiều cột cho các trường độc lập
* **Nguyên lý:** Nghiên cứu Baymard Institute chỉ ra form nhiều cột làm gãy luồng di chuyển của mắt.
* **Cách sửa:** Ưu tiên bố cục **1 cột duy nhất (Single-column)** theo chiều dọc. Chỉ gộp cột khi các trường có quan hệ mật thiết trực tiếp (ví dụ: *Tỉnh/Thành phố* đi liền với *Mã bưu điện*).

### 2.3 Dùng Placeholder thay thế hoàn toàn cho Label
* **Nguyên lý:** Vi phạm nguyên tắc *Recognition Rather Than Recall* (NN/g).
* **Dấu hiệu:** Nhãn biến mất ngay khi con trỏ chuột bắt đầu gõ ký tự đầu tiên.
* **Tác động:** Khiến người dùng quên mất ô đó đang yêu cầu dữ liệu gì nếu bị gián đoạn.
* **Cách sửa:** Luôn giữ label cố định phía trên trường nhập (hoặc dùng floating label). Placeholder chỉ dùng để minh họa ví dụ hoặc format.

### 2.4 Chỉ báo lỗi sau khi submit toàn bộ form
* **Dấu hiệu:** Người dùng điền xong 10 trường, bấm gửi mới thấy báo lỗi đỏ ở đầu trang và phải tự cuộn đi tìm lỗi.
* **Cách sửa:** Áp dụng **Inline Validation** kích hoạt ngay khi rời khỏi trường (`on blur`), hiển thị thông báo lỗi cụ thể ngay dưới trường vi phạm.

### 2.5 CAPTCHA quá phức tạp hoặc lặp lại
* **Tác động:** Rào cản lớn gây rớt chuyển đổi, đặc biệt là thao tác chọn hình trên màn hình di động nhỏ.
* **Cách sửa:** Chuyển sang CAPTCHA vô hình (Invisible reCAPTCHA / Cloudflare Turnstile). Chỉ hiển thị thử thách khi phát hiện rủi ro bot đáng ngờ.

### 2.6 Form KYC yêu cầu dữ liệu nhạy cảm mà không giải thích lý do
* **Dấu hiệu:** Đòi số CCCD, hộ chiếu, ảnh chụp mà không nêu mục đích.
* **Cách sửa:** Bổ sung microcopy ngay tại trường nhập: nêu rõ thu thập theo quy định pháp lý nào và cam kết bảo mật ra sao.

---

## 3. Lỗi Checkout & Luồng chuyển đổi trên website

### 3.1 Bắt buộc tạo tài khoản trước khi cho xem giá
* **Nguyên tắc:** **Value First, Account Later**.
* **Cách sửa:** Cung cấp đầy đủ giá thành và thông tin so sánh trước; chỉ yêu cầu đăng ký khi tiến hành thanh toán hoặc lưu lịch sử.

### 3.2 Ẩn phí phát sinh (Sticker Shock) ở bước cuối
* **Dấu hiệu:** Phí giao hàng, phí dịch vụ chỉ cộng vào ở bước thanh toán cuối cùng làm tổng tiền tăng vọt.
* **Cách sửa:** Minh bạch ước tính chi phí và thuế/phí sớm nhất có thể trong giỏ hàng.

### 3.3 Flow nhiều bước nhưng thiếu thanh tiến độ
* **Cách sửa:** Hiển thị rõ số bước (Ví dụ: `Bước 2/4: Địa chỉ giao hàng`) giúp người dùng ước tính thời gian và duy trì động lực hoàn thành.

### 3.4 Quy trình nạp/rút tiền có quá nhiều màn hình xác nhận trùng lặp
* **Cách sửa:** Rà soát và gộp các bước thừa; chỉ giữ lại các bước cần thiết cho tính toàn vẹn giao dịch và bảo mật pháp lý.

### 3.5 Sửa thông tin bước trước làm xóa sạch tiến trình các bước sau
* **Nguyên tắc:** *User Control and Freedom*.
* **Cách sửa:** Cho phép chỉnh sửa từng bước qua nút "Edit" hoặc thanh tiến độ mà không reset trắng dữ liệu các bước kế tiếp.

---

## 4. Lỗi CTA & Buttons

### 4.1 Quá nhiều CTA cạnh tranh trên cùng một màn hình
* **Cách sửa:** Xác định duy nhất **1 CTA chính (Primary)** có độ tương phản cao nhất. Các lựa chọn khác chuyển thành nút phụ (Secondary) hoặc Ghost button/Text link.

### 4.2 Nhãn CTA chung chung, không nói rõ kết quả
* **Công thức chuẩn:** `Hành động (Action) + Kết quả nhận được (Outcome)`.
  * *Tránh:* "Submit", "Click vào đây".
  * *Nên dùng:* "Tải báo cáo kiểm toán ngay", "Đặt lịch tư vấn miễn phí".

### 4.3 Vùng chạm (Touch target) quá nhỏ trên Mobile
* **Quy chuẩn WCAG 2.2:** Vùng chạm tối thiểu đạt **$24 \times 24\text{ CSS px}$**.
* **Khuyến nghị Usability:** Tối ưu tốt nhất cho ngón tay cái là **$44 \times 44\text{ px}$** cùng khoảng cách đệm an toàn xung quanh.

### 4.4 Nút CTA thiếu độ tương phản với nền
* **Tiêu chuẩn:** Đáp ứng tối thiểu **$4.5:1$** đối với văn bản thông thường và **$3:1$** với chữ lớn theo chuẩn WCAG AA.

### 4.5 Nút CTA bị vô hiệu hóa (Disabled) mà không rõ lý do
* **Cách sửa:** Thay vì để nút xám bất động khiến user tưởng lỗi, hãy hiển thị tooltip hoặc dòng chữ giải thích điều kiện còn thiếu (ví dụ: *"Vui lòng nhập đủ số điện thoại để tiếp tục"*).

---

## 5. Lỗi Visual Hierarchy & Layout

### 5.1 Mọi phần tử đều cùng lúc nổi bật
* **Dấu hiệu:** Chữ to, in đậm, màu rực rỡ, badge HOT/SALE tràn ngập cạnh tranh nhau.
* **Cách sửa:** Xây dựng luồng dẫn mắt: `Thông điệp chính (H1) → Bằng chứng thuyết phục → CTA hành động → Chi tiết phụ`.

### 5.2 Giấu nội dung quyết định mua hàng vào Tab ngang
* **Dữ liệu Baymard:** 28% website dùng tab ngang khiến khách bỏ qua thông số kỹ thuật cốt lõi vì không nhận ra phải click.
* **Cách sửa:** Đưa thông số quan trọng ra ngoài màn hình chính; tab chỉ dùng cho nội dung tham khảo bổ sung.

### 5.3 Phân bổ khoảng cách vi phạm nguyên tắc Gestalt Proximity
* **Nguyên tắc:** Phần tử gần nhau sẽ được não bộ tự gom thành một nhóm.
* **Cách sửa:** Đảm bảo **khoảng cách giữa các nhóm khác nhau** phải lớn hơn rõ rệt so với **khoảng cách giữa các phần tử nội bộ trong cùng nhóm**.

### 5.4 Cỡ chữ và khoảng cách thiếu đồng bộ
* **Cách sửa:** Đồng bộ hóa Design System thông qua hệ thống **Type Scale** và **Spacing Tokens** nhất quán trên toàn site.

---

## 6. Lỗi Mobile & Responsive

### 6.1 Tư duy Desktop-first thu nhỏ xuống Mobile
* **Cách sửa:** Thiết kế theo triết lý **Mobile-first**: ưu tiên cấu trúc 1 cột, nội dung cốt lõi đặt trong tầm với ngón tay cái (thumb zone), sau đó mới mở rộng layout lên Desktop.

### 6.2 Cỡ chữ quá bé buộc người dùng phải phóng to (Zoom)
* **Tiêu chuẩn:** Cỡ chữ nội dung chính (body text) trên mobile tối thiểu từ **16px**, line-height thoáng từ **1.5 đến 1.7**.

### 6.3 Layout nhảy giật khi tài nguyên tải xong (Lỗi CLS)
* **Chỉ số:** Cumulative Layout Shift trong Google Core Web Vitals ($CLS < 0.1$).
* **Cách sửa:** Luôn giữ chỗ trước (reserve aspect ratio) cho hình ảnh, video, banner quảng cáo.

### 6.4 Popup chiếm trọn màn hình và khó tìm nút tắt
* **Cách sửa:** Nút đóng popup phải có kích thước tối thiểu $44 \times 44\text{ px}$, đặt ở vị trí trực quan, không khóa góc nhìn nội dung nền.

---

## 7. Lỗi Performance & Loading

### 7.1 Tải chậm nhưng không có trạng thái Loading
* **Nguyên lý:** *Visibility of System Status*.
* **Cách sửa:** Sử dụng **Skeleton Screen** hoặc spinner ngay lập tức khi phát sinh thao tác tải dữ liệu.

### 7.2 Ảnh dung lượng nặng làm chậm chỉ số LCP
* **Chỉ số:** Largest Contentful Paint ($LCP \le 2.5\text{ giây}$).
* **Cách sửa:** Dùng định dạng hiện đại (WebP, AVIF), nén ảnh phù hợp với viewport, áp dụng lazy-loading cho các ảnh nằm dưới màn hình đầu (below the fold).

### 7.3 Không khóa nút khi đang xử lý (Nguy cơ Duplicate Request)
* **Cách sửa:** Ngay sau click đầu tiên, khóa nút (disable) và hiển thị trạng thái *"Đang xử lý..."*, kết hợp xử lý Idempotent ở backend để ngăn chặn lặp đơn/giao dịch.

---

## 8. Lỗi Trust & Transparency

### 8.1 Giấu thông tin pháp lý và đơn vị vận hành
* **Cách sửa:** Công khai giấy phép kinh doanh, tên công ty đại diện pháp luật, địa chỉ và mã số thuế minh bạch ở Footer hoặc trang Pháp lý riêng.

### 8.2 Lời chứng thực (Testimonial) vô căn cứ
* **Cách sửa:** Social proof cần có danh tính: Tên thật, chức danh, tên công ty hoặc link dự án thực tế có thể đối chiếu.

### 8.3 Kênh thông tin liên hệ bị ẩn sâu
* **Cách sửa:** Đặt nút/trang Liên hệ ở Header và Footer; cung cấp đa kênh minh bạch: Hotline, Email, Địa chỉ thực tế trên bản đồ.

### 8.4 Tạo cảm giác khan hiếm giả mạo (Fake Urgency)
* **Dấu hiệu:** Đồng hồ đếm ngược về 0 rồi tự reset, số lượng phòng/chỗ còn lại giả tạo.
* **Hậu quả:** Phá vỡ niềm tin thương hiệu và đối mặt rủi ro pháp lý về hành vi gian dối thương mại.

---

## 9. Lỗi Feedback & System Status

### 9.1 Nhấp chuột không có phản hồi trạng thái
* **Cách sửa:** Cung cấp hiệu ứng micro-interaction lập tức (hover, active state, loading icon) để người dùng biết thao tác đã được ghi nhận.

### 9.2 Submit thành công nhưng không có trang xác nhận rõ ràng
* **Cách sửa:** Điều hướng đến màn hình cảm ơn (Thank You / Confirmation page) kèm mã tham chiếu giao dịch và gửi email biên nhận tự động.

---

## 10. Lỗi Error Handling & Recovery

### 10.1 Thông báo lỗi chung chung, vô tích sự
* **Tránh:** "Đã có lỗi xảy ra", "Vui lòng thử lại sau".
* **Chuẩn mực:** Nêu rõ: `Lỗi gì + Ở trường nào + Hướng dẫn sửa cụ thể kèm ví dụ`.

### 10.2 Báo lỗi là xóa sạch toàn bộ dữ liệu form đã nhập
* **Cách sửa:** Luôn giữ nguyên các trường dữ liệu hợp lệ; chỉ focus và yêu cầu user chỉnh sửa đúng trường sai sót.

### 10.3 Thiếu cơ chế Hoàn tác (Undo) cho hành động nguy hiểm
* **Nguyên tắc:** *User Control and Freedom*.
* **Cách sửa:** Cho phép khoảng thời gian đệm để hoàn tác (ví dụ: pop-up "Hoàn tác trong 10 giây") hoặc yêu cầu hộp thoại xác nhận với các lệnh xóa vĩnh viễn.

---

## 11. Lỗi Search & Filter

### 11.1 Bộ tìm kiếm không chấp nhận sai chính tả
* **Cách sửa:** Ứng dụng **Fuzzy search**, hỗ trợ typo tolerance và hiển thị gợi ý thông minh: *"Có phải bạn muốn tìm..."*.

### 11.2 Thiếu tính năng Autosuggest khi gõ
* **Cách sửa:** Hiển thị danh sách gợi ý từ khóa, sản phẩm hoặc danh mục theo thời gian thực (realtime) ngay khi gõ từ 2-3 ký tự.

### 11.3 Trang 0 kết quả trở thành ngõ cụt (Dead End)
* **Cách sửa:** Khi không tìm thấy sản phẩm, đề xuất các danh mục phổ biến, từ khóa tương tự hoặc danh sách mặt hàng bán chạy.

### 11.4 Bày ra quá nhiều tiêu chí bộ lọc cùng lúc
* **Cách sửa:** Áp dụng nguyên tắc **Progressive Disclosure**: Chỉ hiển thị sẵn 3-4 bộ lọc thông dụng nhất, các tiêu chí phức tạp ẩn trong accordion "Bộ lọc nâng cao".

---

## 12. Lỗi Accessibility

### 12.1 Độ tương phản (Contrast) màu sắc dưới chuẩn
* **Tiêu chuẩn WCAG 2.2 Level AA:**
  * Văn bản thông thường: Tỷ lệ tương phản tối thiểu **$4.5:1$**.
  * Văn bản lớn / UI component: Tỷ lệ tối thiểu **$3:1$**.

### 12.2 Hình ảnh nội dung thiếu thẻ mô tả `alt`
* **Cách sửa:** Viết thẻ `alt` ngắn gọn mô tả chính xác nội dung ảnh (cho Screen Reader và SEO). Ảnh thuần trang trí đặt `alt=""`.

### 12.3 Không thể hoàn tất tác vụ bằng bàn phím
* **Tiêu chuẩn:** Mọi nút bấm, link, ô nhập phải kích hoạt được bằng phím `Tab`, `Enter`, `Space`, `Esc`; đảm bảo đường viền focus (Focus Indicator) hiển thị rõ ràng.

---

## 13. Lỗi Content & Microcopy

### 13.1 Lạm dụng thuật ngữ kỹ thuật khó hiểu
* **Cách sửa:** Dùng ngôn ngữ đời thường; các thuật ngữ đặc thù (như Gas fee, Slippage) cần gắn icon tooltip giải thích tại chỗ.

### 13.2 Nội dung dài dòng, thiếu cấu trúc lướt đọc
* **Cách sửa:** Áp dụng quy tắc một ý mỗi đoạn, đưa hành động chính lên trước, dùng bullet point và in đậm từ khóa chính.

### 13.3 Cùng một chức năng nhưng gọi bằng nhiều nhãn khác nhau
* **Cách sửa:** Chuẩn hóa thuật ngữ thống nhất trong Design System (ví dụ: chọn cố định từ *"Nạp tiền"*, không đổi thành *"Thêm tiền"* hay *"Deposit"* ở các màn hình khác).

---

## 14. Lỗi Onboarding & Empty States

### 14.1 Quy trình Onboarding kéo dài trước khi mang lại giá trị
* **Nguyên tắc:** Tối ưu hóa **Time-to-Value (TTV)** đưa người dùng đến khoảnh khắc "Aha!" nhanh nhất bằng quy trình thích ứng lũy tiến (Progressive Onboarding).

### 14.2 Empty State trống rỗng, không dẫn hướng
* **Cách sửa:** Màn hình rỗng phải gồm: `Giải thích lý do chưa có dữ liệu + Lợi ích + CTA khởi tạo đầu tiên`.

### 14.3 Tour hướng dẫn ép xem toàn màn hình
* **Cách sửa:** Bỏ màn hình chặn bắt buộc; chuyển sang các gợi ý ngữ cảnh tự nhiên (Contextual Hints) xuất hiện đúng lúc người dùng sử dụng tính năng.

---

## 15. Lỗi Dark Patterns

### 15.1 Hộp kiểm (Checkbox) nhận bản tin được đánh dấu sẵn
* **Cách sửa:** Tuân thủ quyền riêng tư: Checkbox marketing luôn để trống mặc định (**Unchecked by default**) để người dùng chủ động đồng thuận.

### 15.2 Dùng ngôn từ công kích khi từ chối (Confirm Shaming)
* **Dấu hiệu:** Nút từ chối ghi: *"Không, tôi không muốn tiết kiệm tiền"*.
* **Cách sửa:** Dùng ngôn từ trung lập và bình đẳng cho cả 2 lựa chọn: *"Nhận ưu đãi"* và *"Để sau"*.

### 15.3 Quy trình hủy phức tạp hơn nhiều so với quy trình đăng ký
* **Nguyên tắc:** **Symmetric Flow**.
* **Cách sửa:** Đăng ký trực tuyến đơn giản bao nhiêu thì tính năng hủy dịch vụ cũng phải cho phép thực hiện online tương ứng bấy nhiêu.

---

## Cách ưu tiên lỗi UX/UI Website

Khi tiến hành tối ưu, phân loại các lỗi phát hiện được theo ma trận 4 cấp độ:

| Mức độ | Tiêu chuẩn áp dụng | Ví dụ thực tế |
| :--- | :--- | :--- |
| **P0 (Khẩn cấp)** | Chặn đứng tác vụ, lỗi bảo mật hoặc gây mất dữ liệu nghiêm trọng | Mất toàn bộ form khi tải lại, nút thanh toán không hoạt động |
| **P1 (Nghiêm trọng)**| Tác động trực tiếp đến tỷ lệ chuyển đổi và niềm tin cốt lõi | Phí phát sinh bất ngờ, form quá nhiều bước, thiếu thông tin pháp lý |
| **P2 (Trung bình)** | Làm chậm tiến trình, tăng ma sát và thời gian thao tác | Tìm kiếm không chấp nhận lỗi chính tả, bộ lọc quá tải |
| **P3 (Nhẹ)** | Suy giảm tính nhất quán thẩm mỹ và trải nghiệm vi mô | Sai lệch type scale, khoảng cách đệm không đều |

> **Công thức ưu tiên:** $\text{Priority} = \text{Impact} \times \text{Frequency} \times \text{Risk}$ (sau đó cân đối theo Effort kỹ thuật).

---

## Quy trình audit UX/UI website trong 90 phút

1. **Xác định 3 tác vụ quan trọng nhất (Top 3 User Goals):** Tập trung vào luồng chuyển đổi sống còn (Mua hàng, Điền form tư vấn, Đăng ký dịch vụ).
2. **Kiểm tra trên thiết bị di động trước (Mobile-first Walkthrough):** Đi qua toàn bộ hành trình trên smartphone để tìm điểm nghẽn, thao tác bấm nhầm và độ trễ.
3. **Soát các điểm ma sát cao (High-Friction Points):** Tập trung vào Menu, Form input, Inline validation, Loading indicator, Error message và Nút CTA.
4. **Đo lường Performance & Accessibility:**
   * **Core Web Vitals:** $LCP \le 2.5\text{s}$, $INP < 200\text{ms}$, $CLS < 0.1$.
   * **Accessibility:** Dùng phím `Tab` duyệt toàn bộ trang, kiểm tra tương phản màu sắc.
5. **Ghi nhận hồ sơ lỗi chuẩn mực:**
   $$\text{Issue} \rightarrow \text{Evidence} \rightarrow \text{Impact} \rightarrow \text{Fix} \rightarrow \text{Priority (P0 - P3)} \rightarrow \text{Owner}$$
6. **Đưa vào Backlog triển khai:** Sắp xếp theo mức độ ưu tiên từ P0 đến P3 và phân công kỹ thuật xử lý.

---

## UX/UI ảnh hưởng đến SEO như thế nào

Trải nghiệm người dùng và SEO kết nối theo mô hình 3 tầng:

1. **UX/UI Interaction:** Giảm thiểu ma sát, giữ chân người dùng tương tác sâu và hoàn thành mục tiêu.
2. **Technical Performance (Core Web Vitals):** Google sử dụng tốc độ tải, độ phản hồi và tính ổn định bố cục làm tiêu chí xếp hạng trang (Page Experience).
3. **Search Engine Optimization (SEO):** Nội dung giá trị, thỏa mãn nhu cầu tìm kiếm (Search Intent) kết hợp với cấu trúc website trực quan giúp Google crawl, index và đánh giá độ tin cậy của trang tốt hơn.