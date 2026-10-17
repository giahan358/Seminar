## Đọc file danh sách api.md để biết thêm chi tiết
## 1. Ma trận quyền tóm tắt

| Tài nguyên/hành động | UNIT | ADMIN |
|---|---:|---:|
| Xem/cập nhật hồ sơ của đơn vị mình | Có, trong đúng trạng thái/hạn | Có |
| Xem hồ sơ/điểm/minh chứng đơn vị khác | Không | Có |
| Tạo tài khoản, quản lý đơn vị | Không | Có |
| Cấu hình đợt, phase, tiêu chí, ngưỡng | Không | Có |
| Gửi tự chấm và minh chứng | Có, theo thời hạn | Không thay mặt UNIT; có quyền xem |
| Chấm điểm Admin, yêu cầu bổ sung, chốt điểm | Không | Có |
| Dashboard toàn hệ thống, export, audit | Không | Có |
| Đọc thông báo | Chỉ của mình | Chỉ của mình |



## 2. Phân công triển khai backend 

Chia việc theo **luồng nghiệp vụ hoàn chỉnh**, không chia một luồng giữa nhiều người. Người phụ trách chức năng làm trọn route/controller, DTO validation, service, truy cập Prisma, phân quyền nghiệp vụ, xử lý lỗi và test cho các API trong phạm vi. Nhóm trưởng nhận nhiều hơn một chức năng, ngoài ra còn điều phối tích hợp và review.

| Thành viên | Chức năng sở hữu | Toàn bộ phạm vi API phải làm | Trách nhiệm chính |
|---|---|---|---|
| **BE1-Gia Hân** | **Tài khoản và dịch vụ dùng chung:** toàn bộ Mục 2; thông báo và audit trong Mục 6 | Toàn bộ `/auth`, `/users`, `/units`; toàn bộ API `/notifications` và `/admin/audit-logs` | Làm trọn đăng nhập/tài khoản/đơn vị; cung cấp guard/RBAC, danh tính đăng nhập (`id`, `role`, `unitId`), service ghi audit/phát thông báo Web Push cho các chức năng khác dùng; điều phối tích hợp, review PR và nghiệm thu |
| **BE2-Trọng Hiếu** | **Quản lý đợt thi đua từ cấu hình đến tổng kết:** Mục 3 và Mục 7 | Toàn bộ API `/evaluation-periods` về kỳ, phase, ngưỡng, tiêu chí; toàn bộ API dashboard, leaderboard, phân bố điểm, tiêu chí bị trừ điểm và xuất/tải báo cáo Excel/PDF/Word | Làm trọn cấu hình dữ liệu đầu vào của kỳ và các API tổng hợp đầu ra; sử dụng views trong SQL; validate dữ liệu cấu hình và phạm vi hồ sơ khi xuất báo cáo |
| **BE3-Quốc Việt** | **Trọn vòng đời hồ sơ thi đua:** Mục 4, Mục 5 và phần phản hồi/lịch sử trạng thái trong Mục 6 | Toàn bộ luồng `/evaluations`: khởi tạo/xem hồ sơ, UNIT tự chấm/upload nhiều minh chứng hoặc gửi link/nộp/bổ sung; ADMIN thẩm định/yêu cầu bổ sung/chốt điểm; feedback và status history | Là chủ sở hữu duy nhất của state machine hồ sơ từ `DRAFT` đến `FINALIZED`; triển khai transaction, validate quyền và hạn, tích hợp upload/storage/preview, xử lý trigger DB; viết scheduler auto-lock/hết hạn idempotent |

## 3. Thứ tự ưu tiên triển khai API

Đây là thứ tự ưu tiên để triển khai và tích hợp theo từng lát nghiệp vụ, không yêu cầu một người phải chờ toàn bộ API của người khác hoàn tất. Các thành viên có thể phát triển song song bằng mock/fixture theo contract đã thống nhất; tích hợp với API thật khi từng phần sẵn sàng.

### Ưu tiên 1 — Auth và danh tính

Đây là nền tảng để các API nghiệp vụ xác định người gọi và kiểm tra quyền:

1. `POST /auth/login` — đã triển khai bước đầu.
2. `GET /auth/me` — đã triển khai cùng access-token guard.
3. `POST /auth/refresh`
4. `POST /auth/logout`
5. `POST /auth/change-password`

Cùng lúc chốt `CurrentUser` nội bộ (`id`, `role`, `unitId`), cách gửi `Authorization: Bearer <access_token>` và định dạng lỗi chung. Người làm nghiệp vụ có thể bắt đầu với mock `CurrentUser`, sau đó tích hợp Guard/auth thật.

### Ưu tiên 2 — Cấu hình kỳ và tiêu chí

Đơn vị cần đọc được kỳ đang mở và tiêu chí cần chấm:

- `GET /evaluation-periods` và `GET /evaluation-periods/:periodId`
- `GET /evaluation-periods/:periodId/criteria`
- Các API ADMIN tạo/cập nhật kỳ, phase, tiêu chí và ngưỡng trong Mục 3.

Ban đầu có thể dùng seed/mock dữ liệu kỳ và tiêu chí để phát triển luồng hồ sơ trước khi các API cấu hình hoàn tất.

### Ưu tiên 3 — Luồng hồ sơ tối thiểu

Ưu tiên hoàn thành luồng UNIT tự đánh giá và nộp hồ sơ để kiểm thử end-to-end:

1. `GET /evaluations` và `GET /evaluations/:evaluationId`
2. `PUT /evaluations/:evaluationId/scores/:criterionId/self`
3. Upload nhiều file hoặc lưu link ngoài theo API minh chứng ở Mục 4.
4. `POST /evaluations/:evaluationId/submit`

Khi luồng tối thiểu ổn định, tiếp tục ADMIN thẩm định, yêu cầu bổ sung, UNIT nộp bổ sung và ADMIN chốt điểm theo Mục 5.

### Ưu tiên 4 — Kết quả và hoàn thiện

Sau khi dữ liệu điểm và trạng thái hồ sơ ổn định, triển khai:

- Dashboard, leaderboard và báo cáo Excel/PDF/Word theo Mục 7.
- Notifications, audit log và scheduler nhắc hạn/auto-lock theo Mục 6 và các tác vụ nền tại Mục 5.

Notifications/audit có thể được xây dựng sớm thành service dùng chung; tích hợp các service đó vào sự kiện nghiệp vụ khi luồng tương ứng sẵn sàng.


### Ranh giới sở hữu chức năng

- BE 3 sở hữu **toàn bộ vòng đời evaluation**, bao gồm cả phía UNIT và ADMIN; không tách tự chấm với thẩm định cho hai người khác nhau. Người 2 sở hữu cấu hình kỳ và báo cáo tổng hợp, nhưng không tự triển khai thao tác cập nhật trạng thái/chấm điểm của hồ sơ.
- BE 1 sở hữu service thông báo và audit dùng chung. Người 2/3 gọi service này trong luồng của mình khi cần; không tự ghi trực tiếp thông báo/audit theo logic riêng. Việc gọi service và tích hợp vẫn được kiểm thử cùng chức năng nguồn.
- BE 2 cấu hình phase/criteria/thresholds; Người 3 dùng cấu hình đó trong luồng hồ sơ. Hai người thống nhất DTO/contract và seed/dev data trước khi tích hợp.
- Dashboard và báo cáo do Người 2 làm, đọc dữ liệu do Người 3 cập nhật qua các view trong SQL; thống nhất điều kiện đếm trạng thái và format report trước khi phát triển song song.
- Nhóm trưởng vẫn phải hoàn thành toàn bộ API đã nhận ở Mục 2 và các dịch vụ dùng chung; việc điều phối/review không thay thế phần chức năng được giao.

### Quy tắc phối hợp và thứ tự tích hợp
1. Mỗi người làm trọn chức năng trong phạm vi; có thể hỗ trợ nhau nhưng người sở hữu vẫn chịu trách nhiệm tích hợp, test và sửa lỗi cuối của chức năng.
3. Không sửa schema/migration độc lập cùng lúc. Thay đổi schema phải báo nhóm, qua PR và được nhóm trưởng review; không sửa/xóa migration đã được chia sẻ.
4. Tích hợp theo luồng phụ thuộc: Mục 2 (tài khoản/quyền) → Mục 3 (cấu hình kỳ) → Mục 4–5 (toàn bộ vòng đời hồ sơ do Người 3 thực hiện) → Mục 6–7 (audit/thông báo và tổng kết). Dashboard/báo cáo tích hợp sau khi các trạng thái/điểm hồ sơ có contract ổn định.
