# BÁO CÁO THIẾT KẾ CƠ SỞ DỮ LIỆU (ERD)

## HỆ THỐNG ĐÁNH GIÁ, XẾP LOẠI THI ĐUA CÔNG TÁC ĐOÀN VÀ PHONG TRÀO THANH NIÊN NĂM 2026

**Đơn vị chủ quản:** Ban Thanh niên CATP — **34 Cơ sở Đoàn trực thuộc**

---

### PHẦN 1: TỔNG QUAN VỀ CẤU TRÚC DATABASE (15 BẢNG + 3 VIEW)

Cơ sở dữ liệu đạt chuẩn **3NF**, bám sát mô tả hệ thống: 2 loại tài khoản (Admin / Cơ sở), thang điểm 300 điểm (~30 tiêu chí), quy trình 4 giai đoạn có hẹn giờ tự động khóa.

* **NHÓM 1:** Đơn vị & Tài khoản (3 bảng): `units`, `users`, `refresh_tokens`
* **NHÓM 2:** Đợt thi đua, Thang điểm & Xếp loại (3 bảng): `evaluation_periods`, `rating_thresholds`, `criteria`
* **NHÓM 3:** Hồ sơ đơn vị & Thẩm định (4 bảng): `evaluations`, `criterion_scores`, `evidences`, `evaluation_feedbacks`
* **NHÓM 4:** Nhật ký, Thông báo & Xuất báo cáo (5 bảng): `status_histories`, `notifications`, `web_push_subscriptions`, `audit_logs`, `report_exports`
* **Views:** `v_evaluation_totals`, `v_leaderboard`, `v_criteria_deductions` (+ hàm `fn_rating_for_percent`)

**Ánh xạ từ hệ thống cũ (KPI giảng viên) sang hệ thống mới:**

| Hệ thống cũ | Hệ thống mới |
| --- | --- |
| `departments` | `units` (34 Cơ sở Đoàn) |
| `users` (4 vai trò, lý lịch giảng viên) | `users` (2 vai trò `ADMIN`, `UNIT`; đăng nhập bằng username) |
| `evaluation_periods` (quý/học kỳ) | `evaluation_periods` (theo năm, 6 phase, hẹn giờ) |
| `common_criteria` + `kpi_axes` + `standard_kpis` | `criteria` (một thang điểm duy nhất, cấu hình được) |
| `evaluations` + `evaluation_summaries` | `evaluations` (1 hồ sơ / đơn vị / năm) |
| `common_scores` + `kpi_scores` + `kpi_assignments` | `criterion_scores` (tự chấm + Admin chấm cạnh nhau) |
| `kpi_proposals`, `proposal_reviews`, `bonuses` | **Bỏ** (không có trong mô tả) |
| `evidences` | `evidences` (FILE / LINK) |
| — | `evaluation_feedbacks`, `report_exports` (mới) |

---

### PHẦN 2: CHI TIẾT TỪNG BẢNG

#### I. NHÓM 1: ĐƠN VỊ & TÀI KHOẢN

##### 1. `units` (34 Cơ sở Đoàn trực thuộc Ban Thanh niên CATP)

VD: Đoàn Công an quận/huyện/TP Thủ Đức, Đoàn các Phòng nghiệp vụ, Đoàn Trung đoàn... Danh sách 34 Cơ sở Đoàn do Ban Thanh niên cung cấp rồi import vào bảng này.

| Trường | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | UUID | PK | |
| `code` | VARCHAR | UK, Not Null | Mã cơ sở |
| `name` | VARCHAR | Not Null | Tên Cơ sở Đoàn |
| `unit_type` | VARCHAR | Nullable | Phân loại: `CONG_AN_QUAN_HUYEN` (Công an quận/huyện/TP Thủ Đức), `PHONG_NGHIEP_VU` (Phòng/Ban nghiệp vụ), `DON_VI_TRUC_THUOC` (Trung đoàn, trường, đơn vị khác) |
| `sort_order` | INT | Default 0 | Thứ tự hiển thị |
| `is_active` | BOOLEAN | Default true | Ẩn thay vì xóa cứng |
| `created_at` / `updated_at` | TIMESTAMP | Not Null | |

##### 2. `users` (Admin & tài khoản con)

Xây dựng sẵn 34 tài khoản UNIT (Username/Password riêng) + tài khoản ADMIN của Ban Thanh niên.

| Trường | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | UUID | PK | |
| `username` | VARCHAR | UK, Not Null | Tên đăng nhập |
| `password_hash` | VARCHAR | Not Null | Bcrypt |
| `must_change_password` | BOOLEAN | Default true | Bắt đổi mật khẩu lần đầu (tính năng đổi mật khẩu) |
| `full_name` | VARCHAR | Not Null | Tên người phụ trách / tên tài khoản |
| `email` | VARCHAR | UK, Nullable | Phục vụ thông báo Email |
| `phone` | VARCHAR | Nullable | Phục vụ Zalo ZNS |
| `role` | VARCHAR | Not Null | `ADMIN` hoặc `UNIT` |
| `unit_id` | UUID | FK, Nullable | Bắt buộc với `UNIT`, NULL với `ADMIN` (CHECK). Unique: mỗi cơ sở đúng 1 tài khoản |
| `is_active` | BOOLEAN | Default true | |
| `last_login_at` | TIMESTAMP | Nullable | |
| `created_at` / `updated_at` | TIMESTAMP | Not Null | |

> Quy tắc "chỉ xem và thao tác dữ liệu của chính đơn vị mình" thực hiện nhờ `users.unit_id = evaluations.unit_id` ở tầng truy vấn/API.

##### 3. `refresh_tokens`

Giữ nguyên: `id`, `user_id` (FK), `token_hash` (UK), `expires_at`, `revoked_at`, `created_at`.

---

#### II. NHÓM 2: ĐỢT THI ĐUA, THANG ĐIỂM & XẾP LOẠI

##### 4. `evaluation_periods` (Đợt thi đua năm)

| Trường | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | UUID | PK | |
| `year` | INT | UK | Năm thi đua (2026) |
| `name` | VARCHAR | Not Null | |
| `phase` | VARCHAR | Not Null | `SETUP` → `SELF_EVAL` → `FIRST_REVIEW` → `SUPPLEMENT` → `FINAL_REVIEW` → `CLOSED` |
| `max_total_score` | DECIMAL | Default 300 | Tổng điểm thang điểm (mẫu số tính %) |
| `self_eval_start` | TIMESTAMP | Nullable | Thời điểm mở hệ thống (Giai đoạn 1) |
| `self_eval_deadline` | TIMESTAMP | Nullable | Hạn đóng → **Auto-lock** |
| `supplement_hours` | INT | Default 48 | Số giờ bổ sung hồ sơ (Giai đoạn 3), cấu hình riêng từng đợt |
| `published_at` | TIMESTAMP | Nullable | Thời điểm Admin gửi thang điểm cho cơ sở (trước đó được tự do chỉnh sửa) |
| `finalized_at` | TIMESTAMP | Nullable | Thời điểm khóa sổ toàn đợt |
| `created_by_id` | UUID | FK | Admin tạo đợt |
| `created_at` / `updated_at` | TIMESTAMP | Not Null | |

##### 5. `rating_thresholds` (Định mức xếp loại theo % tổng điểm)

| Trường | Kiểu | Mô tả |
| --- | --- | --- |
| `id` | UUID PK | |
| `period_id` | UUID FK | UK cùng `rating` |
| `rating` | VARCHAR | `EXCELLENT` / `GOOD` / `PASS` / `FAIL` |
| `label` | VARCHAR | Hoàn thành xuất sắc / tốt / hoàn thành / không hoàn thành nhiệm vụ |
| `min_percent` | DECIMAL | Cận dưới (%) |
| `min_exclusive` | BOOLEAN | `true` = "trên" (không gồm cận dưới) |
| `color` | VARCHAR | Màu hiển thị Dashboard |

Dữ liệu theo quy chế (mỗi mức lấy cận dưới, hàm `fn_rating_for_percent` chọn mức cao nhất thỏa điều kiện nên không lọt khe tại mốc):

| Mức | Điều kiện | `min_percent` | `min_exclusive` |
| --- | --- | --- | --- |
| `EXCELLENT` | > 85% | 85 | true |
| `GOOD` | 65% ≤ x ≤ 85% | 65 | false |
| `PASS` | 50% ≤ x < 65% | 50 | false |
| `FAIL` | < 50% | 0 | false |

Đã kiểm thử các mốc: 49,99→FAIL · 50→PASS · 64,99→PASS · 65→GOOD · 85→GOOD · 85,01→EXCELLENT.

##### 6. `criteria` (Thang điểm ~30 tiêu chí / 300 điểm)

| Trường | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | UUID | PK | |
| `period_id` | UUID | FK | Thang điểm thuộc đợt nào |
| `parent_id` | UUID | FK, Nullable | Nhóm cha (nếu chia mục con); trigger bảo đảm cùng đợt |
| `code` | VARCHAR | UK cùng `period_id` | Mã hiển thị (1, 1.1...) |
| `name` | TEXT | Not Null | Tên tiêu chí |
| `description` | TEXT | Nullable | Diễn giải |
| `max_score` | DECIMAL | > 0 | Điểm tối đa (thường 5–15), Admin chỉnh được |
| `evidence_requirement` | TEXT | Nullable | Yêu cầu minh chứng do Admin quy định |
| `allow_text` / `allow_file` / `allow_link` | BOOLEAN | Default true | Loại minh chứng được phép nhập (ký tự / file / link) |
| `evidence_required` | BOOLEAN | Default true | Có bắt buộc minh chứng không |
| `sort_order` | INT | Not Null | |
| `created_at` / `updated_at` | TIMESTAMP | Not Null | |

---

#### III. NHÓM 3: HỒ SƠ ĐƠN VỊ & THẨM ĐỊNH

##### 7. `evaluations` (Hồ sơ thi đua của 1 đơn vị / 1 đợt)

UNIQUE(`period_id`, `unit_id`) → 34 hồ sơ mỗi đợt.

| Trường | Kiểu | Mô tả |
| --- | --- | --- |
| `id` | UUID PK | |
| `period_id`, `unit_id` | UUID FK | |
| `status` | VARCHAR | `DRAFT` (chưa nộp/đang làm dở) · `PENDING_REVIEW` (chờ duyệt, đã khóa) · `SUPPLEMENT_REQUESTED` (đang đếm ngược 48h) · `SUPPLEMENT_SUBMITTED` (đã bổ sung, chờ thẩm định) · `SUPPLEMENT_EXPIRED` (hết 48h, khóa vĩnh viễn) · `FINALIZED` (đã chốt) |
| `submitted_at` | TIMESTAMP | Đơn vị bấm nộp |
| `auto_locked_at` | TIMESTAMP | Hệ thống Auto-lock khi hết hạn Giai đoạn 1 |
| `first_reviewed_at` | TIMESTAMP | Admin hoàn tất thẩm định lần 1 |
| `supplement_requested_at` | TIMESTAMP | Admin bấm "Yêu cầu bổ sung hồ sơ" |
| `supplement_deadline` | TIMESTAMP | = requested_at + `supplement_hours` (đồng hồ đếm ngược riêng từng đơn vị) |
| `supplement_submitted_at` | TIMESTAMP | Đơn vị nộp bổ sung |
| `finalized_at` / `finalized_by_id` | TIMESTAMP / FK | Admin bấm "Khóa sổ/Chốt điểm" |
| `final_score`, `final_percent`, `final_rating` | DECIMAL / DECIMAL / VARCHAR | Kết quả chính thức, chốt khi khóa sổ (CHECK bắt buộc khi `FINALIZED`) |
| `created_at` / `updated_at` | TIMESTAMP | |

##### 8. `criterion_scores` (Điểm từng tiêu chí — giao diện side-by-side)

UNIQUE(`evaluation_id`, `criterion_id`).

| Trường | Kiểu | Mô tả |
| --- | --- | --- |
| `id` | UUID PK | |
| `evaluation_id`, `criterion_id` | UUID FK | |
| `self_score` | DECIMAL | Điểm cơ sở tự chấm (≤ `max_score`) |
| `self_note` | TEXT | Nội dung diễn giải (Text Editor) |
| `admin_score` | DECIMAL | Điểm Admin chấm (mặc định = tự chấm, Admin sửa được) |
| `admin_comment` | TEXT | Bình luận/ý kiến thẩm định. **Bắt buộc** (CHECK `criterion_scores_admin_reason_check`) khi `admin_score` khác `self_score` |
| `needs_supplement` | BOOLEAN | Mục Admin yêu cầu bổ sung (chỉ các mục này được sửa trong 48h) |
| `supplement_note` | TEXT | Nội dung yêu cầu bổ sung cho mục này |
| `reviewed_by_id`, `reviewed_at` | FK / TIMESTAMP | Admin thẩm định |
| `created_at` / `updated_at` | TIMESTAMP | |

**Trigger `check_criterion_score_rules`** bảo vệ nghiệp vụ ngay tại DB:
* Tiêu chí và hồ sơ phải cùng đợt; chỉ tiêu chí lá được chấm.
* `self_score` và `admin_score` không vượt `max_score`.
* **Cơ sở chỉ sửa phần tự chấm khi** hồ sơ `DRAFT`, hoặc `SUPPLEMENT_REQUESTED` + đúng mục `needs_supplement` + còn trong hạn 48h → hiện thực hóa Auto-lock.

* Khi đơn vị sửa điểm tự chấm ở giai đoạn bổ sung, `admin_score`/`reviewed_*` tự reset về NULL để Admin chấm lại (tránh vi phạm ràng buộc lý do và tránh giữ điểm cũ).

**Điểm "trừ"** = `self_score - admin_score` (suy ra, không lưu thừa).

##### 9. `evidences` (Minh chứng đa phương tiện)

| Trường | Kiểu | Mô tả |
| --- | --- | --- |
| `id` | UUID PK | |
| `criterion_score_id` | UUID FK | Minh chứng thuộc dòng điểm nào |
| `uploader_id` | UUID FK | |
| `kind` | VARCHAR | `FILE` (ảnh JPG/PNG, PDF, Word) hoặc `LINK` (Fanpage/Website/Google Drive) |
| `round` | VARCHAR | `INITIAL` (Giai đoạn 1) hoặc `SUPPLEMENT` (Giai đoạn 3) |
| `file_name`, `mime_type`, `size_bytes`, `storage_path` | | Thông tin file (bắt buộc `file_name` + `storage_path` khi `FILE`) |
| `external_url` | VARCHAR | Bắt buộc khi `LINK` |
| `description` | TEXT | |
| `created_at` | TIMESTAMP | |

Một dòng điểm có **nhiều** minh chứng (hỗ trợ tải nhiều file); `mime_type` bị giới hạn ở các định dạng cho phép.

**Preview file:** `preview_status` (`NOT_REQUIRED` cho ảnh/PDF xem trực tiếp, `PENDING`/`READY`/`FAILED` cho file Word cần worker convert sang PDF) và `preview_path` (bản xem trước). Worker cập nhật 2 cột này vẫn được khi hồ sơ đã khóa.

**Trigger `check_evidence_edit_rules`** (INSERT / UPDATE / DELETE): chỉ cho thay đổi minh chứng khi hồ sơ `DRAFT` (round phải là `INITIAL`), hoặc `SUPPLEMENT_REQUESTED` + mục có `needs_supplement = true` + còn trong hạn 48h (minh chứng mới phải là `SUPPLEMENT`). Mọi trường hợp khác bị khóa; không cho chuyển minh chứng sang mục khác.

##### 10. `evaluation_feedbacks` (Phản hồi / yêu cầu giải trình)

`id`, `evaluation_id` (FK), `author_id` (FK), `type` (`SUPPLEMENT_REQUEST` / `EXPLANATION_REQUEST` / `GENERAL` / `UNIT_REPLY`), `content`, `created_at`.

---

#### IV. NHÓM 4: NHẬT KÝ, THÔNG BÁO & XUẤT BÁO CÁO

##### 11. `status_histories`
Lịch sử chuyển trạng thái (chỉ INSERT). `actor_id` **NULL = hệ thống tự động** (Auto-lock, hết 48h). Trường: `evaluation_id`, `actor_id`, `from_status`, `to_status`, `comment`, `created_at`.

##### 12. `notifications`
`user_id`, `channel` (`SYSTEM` / `WEB_PUSH` / `EMAIL` / `ZALO_ZNS`), `type`, `title`, `body`, `ref_type`, `ref_id`, `is_read`, `scheduled_at` (nhắc hẹn giờ, VD "còn 24h"), `sent_at`, `created_at`.

##### 13. `web_push_subscriptions`
Lưu đăng ký Web Push theo từng trình duyệt/thiết bị: `id`, `user_id` (FK tới `users`), `endpoint` (unique), khóa `p256dh`/`auth`, `expiration_time`, `user_agent`, `created_at`, `updated_at`, `revoked_at`. Một user có thể đăng ký nhiều thiết bị; endpoint chỉ thuộc một tài khoản. Khi dịch vụ push trả `404`/`410`, backend thu hồi subscription tương ứng.

##### 14. `audit_logs`
Ai sửa (`actor_id`), hành vi (`action`), đối tượng (`entity`, `entity_id`), giá trị cũ → mới (`before`, `after` JSON), `ip`, thời điểm (`created_at`). Dùng để truy vết "sửa từ mấy điểm thành mấy điểm, lúc mấy giờ".

##### 15. `report_exports`
Lịch sử xuất báo cáo: `report_type` (`SUMMARY_ALL_UNITS` — Bảng tổng hợp 34 cơ sở; `UNIT_APPRAISAL_MINUTES` — Biên bản thẩm định từng đơn vị), `format` (`XLSX` / `PDF` / `DOCX`), `storage_path`, `period_id`, `evaluation_id`, `created_by_id`, `created_at`.

---

#### V. VIEW PHỤC VỤ TÍNH ĐIỂM REAL-TIME & DASHBOARD

| Đối tượng | Chức năng |
| --- | --- |
| `fn_rating_for_percent(period_id, %)` | Trả về mức xếp loại theo `rating_thresholds` |
| `v_evaluation_totals` | Tổng tự chấm (`self_total`), tổng điểm hiệu lực (`current_total` = điểm Admin nếu có, ngược lại tự chấm), `current_percent`, `suggested_rating` → **cộng dồn & gợi ý xếp loại tạm thời** |
| `v_leaderboard` | Bảng xếp hạng theo điểm giảm dần, kèm xếp loại để tô màu. `score_rank` = đồng hạng theo điểm; `rank` = thứ tự cuối cùng, **hòa điểm thì đơn vị nộp sớm hơn đứng trước** (`submitted_at`, hoặc `auto_locked_at` nếu bị khóa tự động), sau đó theo `sort_order` đơn vị |
| `v_criteria_deductions` | Mỗi tiêu chí có bao nhiêu đơn vị bị trừ điểm và tổng điểm bị trừ → biểu đồ điểm yếu chung |

**Dashboard tiến độ** truy vấn trực tiếp `evaluations.status`: Đã nộp = `PENDING_REVIEW`/`SUPPLEMENT_SUBMITTED`/`FINALIZED`, Chưa nộp = `DRAFT`, Chờ thẩm định bổ sung = `SUPPLEMENT_REQUESTED`/`SUPPLEMENT_SUBMITTED`. Phổ điểm dùng `v_evaluation_totals.current_total`.

---

### PHẦN 3: LUẬN ĐIỂM BẢO VỆ DATABASE

1. **Bám sát quy trình 4 giai đoạn:** `evaluation_periods.phase` + `evaluations.status` + các mốc thời gian (`auto_locked_at`, `supplement_deadline`, `finalized_at`) mô tả đầy đủ vòng đời hồ sơ.
2. **Khóa dữ liệu ngay tại DB:** Trigger chặn đơn vị sửa điểm sau khi bị Auto-lock hoặc ngoài các mục được yêu cầu bổ sung; CHECK ngăn chốt điểm khi chưa đủ kết quả.
3. **Tách biệt dữ liệu & cấu hình:** Thang điểm, mức xếp loại, số giờ bổ sung đều cấu hình theo đợt, Admin tự chỉnh mà không sửa code.
4. **Minh bạch & truy vết:** `status_histories` (có cả thao tác tự động của hệ thống) và `audit_logs` ghi nhận mọi thay đổi điểm; `report_exports` lưu biên bản đã xuất.
5. **Không dư thừa (3NF):** Điểm trừ, tổng điểm, xếp hạng được suy ra qua View, chỉ chốt lưu một lần khi khóa sổ.
