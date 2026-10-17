# Đặc tả API backend — Hệ thống đánh giá thi đua Đoàn

Tài liệu API này được viết theo yêu cầu đề tài và schema PostgreSQL tại [`seminar_csdl.sql`](./seminar_csdl.sql). Đây là đặc tả để triển khai

Các request/response mẫu, quy ước lỗi và checklist để FE/BE chốt contract được ghi trong [`API_CONTRACT.md`](./API_CONTRACT.md).

## 1. Quy ước nghiệp vụ và bảo mật
- Phân trang danh sách: `page`, `page_size`; mặc định `1`, `20`, giới hạn `100`.
- Không trả về `password_hash`, `token_hash` hoặc thông tin bí mật.
- Mã vai trò theo SQL: `ADMIN`, `UNIT`. Một tài khoản `UNIT` gắn với đúng một đơn vị; tài khoản `ADMIN` không gắn đơn vị.
- Không có danh sách tên chính thức của 34 đơn vị hoặc 30 tiêu chí trong yêu cầu đầu vào. Dữ liệu seed hiện dùng tên/mã demo; Admin cấu hình danh sách và tiêu chí thực tế trước khi mở đợt.

### Phân quyền

- **Chưa đăng nhập:** chỉ gọi đăng nhập và làm mới access token.
- **UNIT:** chỉ xem/cập nhật hồ sơ của đơn vị gắn với tài khoản; không được truyền `unit_id` để truy cập đơn vị khác.
- **ADMIN:** quản trị đơn vị và tài khoản; cấu hình đợt, thang điểm và ngưỡng; thẩm định, chốt điểm, xem dashboard, audit log và xuất báo cáo.
- Không nhận `role`, `unit_id`, `reviewed_by_id`, `created_by_id`, `actor_id`, điểm chốt hoặc trạng thái tùy ý từ client nếu giá trị phải lấy từ danh tính người dùng hoặc quy tắc server.

### Trạng thái

- Đợt (`evaluation_periods.phase`): `SETUP`, `SELF_EVAL`, `FIRST_REVIEW`, `SUPPLEMENT`, `FINAL_REVIEW`, `CLOSED`.
- Hồ sơ (`evaluations.status`): `DRAFT`, `PENDING_REVIEW`, `SUPPLEMENT_REQUESTED`, `SUPPLEMENT_SUBMITTED`, `SUPPLEMENT_EXPIRED`, `FINALIZED`.
- Minh chứng (`evidences.kind`): `FILE`, `LINK`; vòng nộp: `INITIAL`, `SUPPLEMENT`.
- Mức xếp loại (`rating_thresholds.rating`): `EXCELLENT`, `GOOD`, `PASS`, `FAIL`.
- Trạng thái và điểm không được tự ý chuyển chỉ vì client gửi mã trạng thái. Backend kiểm tra phase, quyền, thời hạn và trạng thái hiện tại trước mỗi thao tác.

### Quy tắc dữ liệu

- Dùng transaction cho thao tác cập nhật nhiều bảng như nộp hồ sơ, thẩm định/yêu cầu bổ sung và chốt điểm.
- SQL trigger kiểm tra tiêu chí cha cùng đợt, điểm thuộc cùng đợt/chỉ chấm tiêu chí lá/không vượt điểm tối đa, và giới hạn sửa điểm/minh chứng. Backend vẫn phải kiểm tra trước để trả lỗi API dễ hiểu; không bỏ qua lỗi constraint/trigger.
- Khi Admin đổi điểm khác điểm tự chấm, bắt buộc có `admin_comment`.
- UNIT chỉ được bổ sung ở tiêu chí có `needs_supplement = true`, trong trạng thái `SUPPLEMENT_REQUESTED` và trước `supplement_deadline`.
- SQL hiện chưa có trigger quản lý chuyển phase/status, tự chạy auto-lock/hết hạn, phân quyền, audit tự động, hay xác thực `report_exports.period_id` khớp với đợt của hồ sơ. Đây là trách nhiệm cần triển khai ở backend/job; không giả định database đã tự thực hiện.
- Hash mật khẩu bằng bcrypt/thuật toán phù hợp; access/refresh token không lưu dạng rõ. Refresh token lưu hash trong `refresh_tokens`.

### Phản hồi lỗi thống nhất

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu gửi lên không hợp lệ",
  "details": []
}
```

Mã HTTP khuyến nghị: `400` dữ liệu sai; `401` chưa xác thực/token sai; `403` không đủ quyền; `404` không tồn tại hoặc ngoài phạm vi truy cập; `409` xung đột trạng thái/unique; `422` vi phạm quy tắc nghiệp vụ; `500` lỗi không dự kiến. Không tiết lộ sự tồn tại của hồ sơ thuộc đơn vị khác.

## 2. Xác thực và tài khoản (`/auth`, `/users`)

### Auth

- `POST /auth/login` — Public. Đăng nhập bằng `username` và mật khẩu; trả access token, refresh token và thông tin cơ bản (`id`, `username`, `role`, `unit_id`, `must_change_password`).
- `POST /auth/refresh` — Public. Nhận refresh token, xác minh hash/hạn dùng/thu hồi; cấp token mới. Nếu dùng rotation, thu hồi token cũ và lưu hash token mới trong cùng transaction.
- `POST /auth/logout` — Đã đăng nhập. Thu hồi refresh token hiện tại bằng cách đặt `revoked_at`.
- `GET /auth/me` — Đã đăng nhập. Trả hồ sơ người dùng và đơn vị tương ứng, không trả dữ liệu nhạy cảm.
- `POST /auth/change-password` — Đã đăng nhập. Nhận `current_password`, `new_password`; cập nhật hash, bỏ cờ `must_change_password`, thu hồi các refresh token khác theo chính sách.

### Người dùng

- `GET /users` — ADMIN. Lọc `role`, `unit_id`, `is_active`; phân trang.
- `POST /users` — ADMIN. Tạo tài khoản `UNIT` hoặc `ADMIN`; validate `unit_id` theo role và tính duy nhất tài khoản cho đơn vị. Sinh mật khẩu tạm hoặc nhận mật khẩu theo chính sách; luôn đặt `must_change_password = true`. Không bao giờ trả password hash.
- `GET /users/:id` — ADMIN; UNIT chỉ được xem chính mình.
- `PATCH /users/:id` — ADMIN cập nhật `full_name`, `email`, `phone`, trạng thái hoạt động, đơn vị/role theo quy tắc. Người dùng chỉ được cập nhật thông tin cá nhân cho phép; không tự nâng quyền hoặc chuyển đơn vị.
- `POST /users/:id/reset-password` — ADMIN. Sinh/đặt mật khẩu tạm; đặt `must_change_password = true`, thu hồi refresh token cũ. Chỉ hiển thị mật khẩu tạm một lần nếu backend sinh mật khẩu.
- `PATCH /users/:id/status` — ADMIN. Khóa/kích hoạt tài khoản; cân nhắc thu hồi toàn bộ refresh token khi khóa.

### Đơn vị (`/units`)

- `GET /units` — ADMIN, UNIT. UNIT chỉ nhận thông tin đơn vị của mình; ADMIN có thể lọc `unit_type`, `is_active` và phân trang.
- `POST /units` — ADMIN. Tạo đơn vị.
- `GET /units/:id` — ADMIN; UNIT chỉ truy cập đơn vị được gắn.
- `PATCH /units/:id` — ADMIN. Cập nhật `code`, `name`, `unit_type`, `sort_order`, `is_active`.
- `GET /units/:id/users` — ADMIN; đơn vị chỉ xem thông tin tài khoản thuộc chính đơn vị (theo nghiệp vụ chỉ có một user UNIT mỗi đơn vị).

## 3. Đợt thi đua, ngưỡng và tiêu chí (`/evaluation-periods`)

- `GET /evaluation-periods` — Đã đăng nhập. ADMIN xem tất cả; UNIT chỉ xem đợt được phép tham gia. Lọc `year`, `phase`.
- `POST /evaluation-periods` — ADMIN. Tạo đợt; `year` duy nhất, `max_total_score > 0`, `supplement_hours > 0`; `created_by_id` lấy từ tài khoản ADMIN.
- `GET /evaluation-periods/:periodId` — Đã đăng nhập theo phạm vi. Trả thông tin đợt, phase/thời hạn và tổng điểm tối đa.
- `PATCH /evaluation-periods/:periodId` — ADMIN. Cập nhật cấu hình và mốc thời gian. Kiểm tra không đảo `self_eval_start`/`self_eval_deadline`; không cho sửa các cấu hình đã khóa theo chính sách phase.
- `POST /evaluation-periods/:periodId/phase-transitions` — ADMIN. Nhận `to_phase`; cho phép các bước chuyển hợp lệ theo state machine, ghi log/audit. Không cho tùy ý nhảy phase hoặc mở lại `CLOSED` nếu không có quy trình được duyệt.
- `GET /evaluation-periods/:periodId/thresholds` — Đã đăng nhập theo phạm vi.
- `PUT /evaluation-periods/:periodId/thresholds` — ADMIN. Thay toàn bộ cấu hình ngưỡng; cần có đủ bốn mức, `min_percent` trong 0–100, giá trị theo yêu cầu: `EXCELLENT` >85, `GOOD` từ 65, `PASS` từ 50, `FAIL` từ 0.
- `GET /evaluation-periods/:periodId/criteria` — Đã đăng nhập theo phạm vi. Trả cây tiêu chí theo `parent_id`, sắp xếp `sort_order`; có thể hỗ trợ `include_inactive` nếu sau này có cờ trạng thái.
- `POST /evaluation-periods/:periodId/criteria` — ADMIN. Tạo tiêu chí/nhóm; validate điểm dương, mã duy nhất trong đợt, parent cùng đợt. Nội dung cho phép text/file/link và yêu cầu minh chứng theo các cột tương ứng.
- `PATCH /criteria/:criterionId` — ADMIN. Sửa nội dung, điểm tối đa, yêu cầu minh chứng, loại bằng chứng, thứ tự, parent; không tạo cây vòng lặp. Không đổi parent/đợt làm sai các bản ghi điểm đã có.
- `DELETE /criteria/:criterionId` — ADMIN. Xóa chỉ khi chưa có điểm tham chiếu và không có tiêu chí con; nếu đã dùng trả `409`. Nếu cần lưu lịch sử, quy định chính sách ngừng sử dụng trước khi thêm cờ vào schema.

## 4. Hồ sơ, tự chấm và minh chứng (`/evaluations`)

- `GET /evaluations` — ADMIN xem toàn đợt; UNIT chỉ hồ sơ của mình. Lọc `period_id`, `unit_id` (ADMIN), `status`; phân trang.
- `POST /evaluations` — ADMIN hoặc tác vụ khởi tạo đợt. Khởi tạo đúng một hồ sơ cho mỗi cặp `period_id` + `unit_id`; có thể tạo hàng loạt cho 34 đơn vị trong transaction. UNIT không tự chọn đơn vị.
- `GET /evaluations/:evaluationId` — Theo quyền. Trả hồ sơ cùng tiêu chí lá, điểm, minh chứng và thông tin trạng thái.
- `POST /evaluations/:evaluationId/submit` — UNIT sở hữu hồ sơ. Chỉ khi đợt `SELF_EVAL`, hồ sơ `DRAFT`, còn trong hạn; validate trường bắt buộc/minh chứng theo cấu hình. Ghi `submitted_at`, đổi sang `PENDING_REVIEW`, thêm `status_histories` và thông báo ADMIN trong transaction.
- `GET /evaluations/:evaluationId/scores` — Theo quyền. Trả điểm theo tiêu chí cùng điểm tối đa và minh chứng.
- `PUT /evaluations/:evaluationId/scores/:criterionId/self` — UNIT sở hữu hồ sơ. Upsert `self_score`, `self_note`; chỉ trong `DRAFT` khi đợt mở hoặc đúng tiêu chí được yêu cầu bổ sung trong hạn. Điểm phải từ 0 đến `max_score`.
- `POST /evaluations/:evaluationId/evidences/upload-urls` — UNIT sở hữu hồ sơ. Nhận danh sách file cần tải lên (tiêu chí/criterion score, tên file, MIME, kích thước và `round`); trả một URL upload có thời hạn và `storage_path` riêng cho mỗi file. Kiểm tra quyền sửa hồ sơ, tiêu chí, MIME được phép (`image/jpeg`, `image/png`, `application/pdf`, Word `.doc`/`.docx`), giới hạn dung lượng/số lượng và round trước khi cấp URL. Với Supabase Storage hoặc object storage tương tự, bucket phải private; browser tải trực tiếp lên storage bằng URL ký sẵn, không gửi nội dung qua API và không đưa service-role key vào frontend.
- `POST /evaluations/:evaluationId/evidences` — UNIT sở hữu hồ sơ. Sau khi upload thành công, xác nhận/lưu metadata file; có thể gửi một hoặc nhiều file theo request. Backend kiểm tra object tồn tại, kích thước/MIME thực tế và quyền của `criterion_score_id`; không tin `storage_path` tùy ý do client gửi. Cũng nhận minh chứng link ngoài (`kind = LINK`, `external_url`), kiểm tra URL/host theo chính sách an toàn. Mỗi file/link được lưu thành một dòng `evidences`.
- `GET /evaluations/:evaluationId/evidences/:evidenceId` — Theo quyền. Trả metadata cùng URL xem/tải có thời hạn; với ảnh/PDF cho phép xem inline, với Word có thể trả file để tải. Không công khai storage path hoặc bucket private.
- `GET /evaluations/:evaluationId/evidences/:evidenceId/preview` — ADMIN hoặc UNIT sở hữu hồ sơ. Trả URL signed cho ảnh/PDF xem trực tiếp. Với Word, nếu đã có worker chuyển đổi thì trả preview PDF theo `preview_status`/`preview_path`; khi đang xử lý trả `202`, nếu chưa tích hợp worker thì thông báo preview không khả dụng và dùng endpoint file để tải Word.
- `PATCH /evaluations/:evaluationId/evidences/:evidenceId` — UNIT sở hữu hồ sơ. Chỉ sửa minh chứng trong `DRAFT` hoặc đúng mục được yêu cầu bổ sung, theo trigger DB.
- `DELETE /evaluations/:evaluationId/evidences/:evidenceId` — UNIT sở hữu hồ sơ. Cùng giới hạn thời gian/trạng thái như cập nhật.

**Luồng upload nhiều file:** frontend xin URL cho các file được chọn → tải từng file trực tiếp lên storage bằng signed URL → gửi metadata để backend xác minh và ghi từng bản ghi `evidences`. Nếu bước xác nhận metadata thất bại, cần xóa object tải dở hoặc có tác vụ dọn object mồ côi. File không được public trực tiếp; endpoint xem/tải luôn xác thực hồ sơ và quyền.

Ví dụ request xin URL cho nhiều file:

```json
{
  "items": [
    {
      "criterion_score_id": "UUID",
      "file_name": "bao-cao.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 125000,
      "round": "INITIAL"
    }
  ]
}
```

Response gồm một phần tử cho mỗi file, tối thiểu có `upload_url`, `method`, `required_headers`, `storage_path` và `expires_at`. Sau khi storage xác nhận upload thành công, frontend gửi `POST /evaluations/:evaluationId/evidences` với các metadata tương ứng để backend kiểm tra object và ghi DB. Tên file hiển thị (`file_name`) được tách khỏi object key ngẫu nhiên do server cấp.

### Tính điểm tức thời

- `GET /evaluation-periods/:periodId/units/:unitId/score-summary` — Theo quyền. Đọc `v_evaluation_totals`; gồm `self_total`, `current_total`, `current_percent`, `suggested_rating`, `max_total_score`.
- UNIT chỉ được truyền đúng `unitId` của mình; có thể thay bằng endpoint `/evaluations/:evaluationId/score-summary` để không nhận unit ID từ client.

## 5. Thẩm định và bổ sung (`/evaluations`)

- `GET /admin/evaluations/:evaluationId/review` — ADMIN. Trả dữ liệu side-by-side: tiêu chí/điểm tối đa, điểm và diễn giải UNIT, minh chứng, điểm Admin/bình luận/cờ bổ sung.
- `PUT /admin/evaluations/:evaluationId/scores/:criterionId/review` — ADMIN. Nhận `admin_score`, `admin_comment`, `needs_supplement`, `supplement_note`; bắt buộc lý do khi điểm khác tự chấm. Gán reviewer từ token và `reviewed_at` từ server.
- `POST /admin/evaluations/:evaluationId/supplement-request` — ADMIN. Nhận danh sách tiêu chí cần bổ sung và phản hồi; kiểm tra hồ sơ đang chờ thẩm định, tạo deadline = thời điểm server + `supplement_hours`, đổi sang `SUPPLEMENT_REQUESTED`, lưu phản hồi/lịch sử và gửi thông báo trong transaction.
- `POST /evaluations/:evaluationId/supplement-submit` — UNIT sở hữu hồ sơ. Chỉ trước deadline khi trạng thái `SUPPLEMENT_REQUESTED`; xác nhận hoàn tất bổ sung, đổi `SUPPLEMENT_SUBMITTED`, ghi thời gian/lịch sử và báo ADMIN.
- `POST /admin/evaluations/:evaluationId/first-review/complete` — ADMIN. Đánh dấu đã hoàn tất thẩm định lần 1 bằng `first_reviewed_at`. Nếu cần bổ sung, dùng endpoint `supplement-request` để chuyển riêng hồ sơ đó sang `SUPPLEMENT_REQUESTED`; nếu không, hồ sơ giữ trạng thái chờ xử lý phù hợp cho vòng chốt. Không dùng endpoint này để tự chuyển phase toàn đợt.
- `POST /admin/evaluations/:evaluationId/finalize` — ADMIN. Chỉ chốt hồ sơ hợp lệ ở giai đoạn `FINAL_REVIEW`; tính điểm hiệu lực từ điểm Admin nếu có, nếu không dùng điểm tự chấm; tính phần trăm trên `max_total_score`, phân loại theo `fn_rating_for_percent`; ghi `final_score`, `final_percent`, `final_rating`, `finalized_at`, `finalized_by_id`, trạng thái `FINALIZED`, lịch sử và audit trong transaction.

### Tác vụ nền bắt buộc

- Scheduler kiểm tra hạn tự chấm: khi phase `SELF_EVAL` hết hạn, chuyển các hồ sơ `DRAFT` sang `PENDING_REVIEW`, ghi `auto_locked_at`, `status_histories`, thông báo nếu chính sách yêu cầu.
- Scheduler kiểm tra deadline bổ sung: chuyển `SUPPLEMENT_REQUESTED` quá hạn sang `SUPPLEMENT_EXPIRED`, ghi lịch sử. Chạy lặp an toàn/idempotent để không ghi sự kiện trùng.
- Trigger SQL khóa sửa điểm/minh chứng nhưng **không tự đổi status**; scheduler/API phải làm việc đó.
- Mốc “48 giờ (2 ngày làm việc)” trong đề tài cần chủ sản phẩm xác nhận cách tính. Cột hiện tại là `supplement_hours` và trigger so sánh timestamp thực (`now()`); mặc định seed 48 giờ liên tục, không tự loại trừ ngày nghỉ.

## 6. Phản hồi, lịch sử, thông báo và audit

### Phản hồi (`/evaluations/:evaluationId/feedback`)

- `GET /evaluations/:evaluationId/feedback` — ADMIN và UNIT sở hữu hồ sơ.
- `POST /evaluations/:evaluationId/feedback` — ADMIN/UNIT theo quy trình. Nhận `type`, `content`; `author_id` lấy từ token. Các type trong SQL: `SUPPLEMENT_REQUEST`, `EXPLANATION_REQUEST`, `GENERAL`, `UNIT_REPLY`.
- `DELETE /evaluation-feedbacks/:feedbackId` — Không có trong bản đầu; bảng chưa có soft-delete và phản hồi cần giữ lịch sử. Chỉ bổ sung khi có quy định chỉnh/xóa rõ ràng.

### Lịch sử (`/evaluations/:evaluationId/status-history`)

- `GET /evaluations/:evaluationId/status-history` — ADMIN, hoặc UNIT sở hữu hồ sơ.
- Lịch sử thêm cùng transaction với chuyển trạng thái; `actor_id = null` dành cho tác vụ hệ thống. Không cung cấp API sửa/xóa lịch sử ở bản đầu.

### Thông báo (`/notifications`)

- `GET /notifications` — Người dùng đã đăng nhập; chỉ thông báo của chính họ. Lọc `is_read`, phân trang.
- `PATCH /notifications/:notificationId/read` — Đánh dấu đã đọc nếu thuộc người gọi.
- `POST /notifications/read-all` — Đánh dấu tất cả thông báo của người gọi đã đọc.
- `GET /notifications/web-push/public-key` — Public. Trả VAPID public key để frontend đăng ký Push API.
- `POST /notifications/web-push/subscriptions` — Đã đăng nhập. Nhận `PushSubscription` (`endpoint`, `expirationTime`, `keys.p256dh`, `keys.auth`) từ trình duyệt; server lấy `user_id` từ danh tính xác thực, không nhận user ID từ body. Cùng endpoint đăng ký lại thì cập nhật khóa và bỏ thu hồi; endpoint đã thuộc user khác thì trả `409`.
- `DELETE /notifications/web-push/subscriptions/current` — Đã đăng nhập. Nhận `endpoint`; thu hồi đúng subscription thuộc user hiện tại. Frontend chỉ unsubscribe local sau khi API thu hồi thành công.
- Khi có sự kiện nghiệp vụ, backend tạo bản ghi `notifications` với `channel = WEB_PUSH`, sau đó gửi payload qua Web Push tới mọi subscription còn hiệu lực của user. Lưu DB trước khi gọi dịch vụ push; khi browser service trả `404`/`410`, thu hồi subscription đó. `sent_at` chỉ được đặt khi ít nhất một push service chấp nhận thông báo, không chứng minh người dùng đã xem/đọc.
- SQL cho phép `channel = SYSTEM`, `WEB_PUSH`, `EMAIL`, `ZALO_ZNS`; triển khai hiện chọn `WEB_PUSH`. `scheduled_at` dành cho scheduler nhắc hẹn (ví dụ còn 24 giờ); cần worker chọn thông báo đến hạn, gửi và ghi `sent_at`. Các lần gửi lỗi tạm thời cần log và cơ chế retry/outbox nếu muốn bảo đảm giao nhận.
- Web Push không cần Socket.IO và có thể hiện thông báo khi ứng dụng không mở, nhưng người dùng phải cấp quyền, trình duyệt/OS phải hỗ trợ, subscription còn hạn và ứng dụng production cần HTTPS. Cần cấu hình VAPID public/private key; private key chỉ ở backend.
- Bảng `web_push_subscriptions` lưu nhiều thiết bị/trình duyệt cho một user, gồm endpoint, khóa, thời điểm hết hạn/thu hồi; mỗi endpoint thuộc tối đa một tài khoản. `ref_type`/`ref_id` trong notifications là đa hình nên backend tự xác thực tham chiếu trước khi lưu.
- **Tình trạng code:** schema/migration Web Push, service/controller backend, service worker frontend và tiện ích bật/tắt push đã được thêm. Các endpoint đăng ký/lịch sử yêu cầu request đã được auth middleware gắn `request.user`; auth hiện là phần nền tảng cần tích hợp trước khi gọi được các endpoint có đăng nhập. Gửi push nghiệp vụ được gọi qua `NotificationsService.notifyUser` khi các module nghiệp vụ được triển khai.

### Audit log (`/admin/audit-logs`)

- `GET /admin/audit-logs` — ADMIN. Lọc theo `actor_id`, `entity`, `entity_id`, khoảng thời gian; phân trang.
- Backend ghi `audit_logs` cho đăng nhập/quản trị, thay đổi cấu hình, chấm/sửa điểm, bổ sung và chốt điểm; ghi actor và before/after, không ghi mật khẩu/token/file nhạy cảm.
- Không cung cấp API sửa/xóa audit log.

## 7. Dashboard, xếp hạng, báo cáo

- `GET /admin/dashboard?period_id=...` — ADMIN. Tổng đơn vị; số hồ sơ đã nộp/chưa nộp/chờ bổ sung; tỷ lệ tiến độ. Xác định rõ trạng thái tính vào từng nhóm để tránh đếm trùng.
- `GET /admin/dashboard/leaderboard?period_id=...` — ADMIN. Đọc `v_leaderboard`, sắp theo `rank`; trả điểm, phần trăm, xếp loại và đơn vị.
- `GET /admin/dashboard/score-distribution?period_id=...` — ADMIN. Tổng hợp phân bố điểm từ `v_evaluation_totals`; có thể nhận `bucket_size` với giới hạn hợp lý.
- `GET /admin/dashboard/criteria-deductions?period_id=...` — ADMIN. Đọc `v_criteria_deductions`, sắp giảm dần theo số đơn vị bị trừ/tổng điểm bị trừ.
- `POST /admin/reports/exports` — ADMIN. Nhận `period_id`, `report_type`, `format`, và `evaluation_id` khi xuất biên bản một đơn vị. `SUMMARY_ALL_UNITS` xuất bảng tổng hợp các đơn vị, hỗ trợ `XLSX`; `UNIT_APPRAISAL_MINUTES` xuất biên bản thẩm định chi tiết của một hồ sơ, hỗ trợ `PDF` hoặc `DOCX`. Không nhận `evaluation_id` cho báo cáo tổng hợp; bắt buộc và phải thuộc đúng `period_id` cho biên bản đơn vị. Tạo file và lưu metadata trong `report_exports`; trả `export_id`, `report_type`, `format`, `created_at` và trạng thái/kết quả tải. Bản đầu có thể tạo đồng bộ; nếu chuyển sang job nền thì cần thêm cách lưu trạng thái job (schema/queue) trước khi trả `202`.
- Request bảng tổng hợp: `{"period_id":"UUID","report_type":"SUMMARY_ALL_UNITS","format":"XLSX"}`. Request biên bản một đơn vị: `{"period_id":"UUID","report_type":"UNIT_APPRAISAL_MINUTES","format":"PDF","evaluation_id":"UUID"}` (có thể chọn `DOCX`). Trả `201` với metadata export và `download_url` có thời hạn hoặc URL lấy file qua endpoint download.
- `GET /admin/reports/exports` — ADMIN. Danh sách lịch sử xuất; lọc theo `period_id`, `report_type`, `format`, phân trang.
- `GET /admin/reports/exports/:exportId/download` — ADMIN. Xác minh quyền và file thuộc bản ghi export; trả redirect hoặc signed URL tải có thời hạn, không trả trực tiếp storage path. Trả `404` nếu export/file không tồn tại.

**Định dạng theo yêu cầu đề tài:** bảng tổng hợp 34 cơ sở → Excel (`.xlsx`); biên bản thẩm định từng đơn vị → PDF (`.pdf`) hoặc Word (`.docx`). Xuất báo cáo và upload/storage ở trên là hợp đồng API cần triển khai, chưa có nghĩa là backend đã có các endpoint này trong code.
