# Phân công frontend cho 2 thành viên

## Nguyên tắc chung

- Chủ sở hữu chức năng làm trọn phần UI, route, service, validation phía giao diện, trạng thái loading/empty/error, responsive cơ bản và kiểm thử phần mình.
- FE không tự quyết định quyền bảo mật: route có thể ẩn chức năng theo role để UX tốt, nhưng backend vẫn phải kiểm tra quyền.
- Dùng field `camelCase` theo API contract. Nếu API thực tế khác contract, thống nhất và cập nhật contract trước khi hai bên tích hợp.
- API chưa sẵn sàng thì dùng fixture/mock theo đúng request/response đã thống nhất; không hard-code mock vào component hoặc bật dữ liệu giả trong production.

## Phân công

| Thành viên | Chức năng sở hữu | Phạm vi chính |
|---|---|---|
| **FE1-Tiến Phát — Nền tảng và khu vực quản trị** | Phần nền tảng frontend, xác thực, cấu hình hệ thống, dashboard/báo cáo và lịch sử thao tác ADMIN | Axios API client; auth/session; route/layout và thành phần dùng chung; trang đăng nhập/đổi mật khẩu; giao diện quản lý tài khoản/đơn vị; cấu hình kỳ/phase/tiêu chí/ngưỡng; dashboard, leaderboard, audit log và màn hình xuất/tải báo cáo Excel/PDF/Word. |
| **FE2-Trường Huy — Trọn luồng hồ sơ thi đua** | Trải nghiệm UNIT tự chấm và toàn bộ giao diện ADMIN xử lý hồ sơ tương ứng | UNIT xem kỳ/hồ sơ, chấm điểm, nhập diễn giải, upload nhiều minh chứng hoặc gửi link, xem trước/tải, theo dõi trạng thái và bổ sung; ADMIN xem hồ sơ side-by-side, chấm và phản hồi, yêu cầu bổ sung, theo dõi lịch sử hồ sơ và chốt điểm; hộp thư và gửi thông báo gắn với xử lý hồ sơ. |

## FE 1 — Nền tảng và khu vực quản trị

### Nhiệm vụ

1. Tạo `src/services/apiClient.js` bằng Axios:
   - `baseURL` lấy từ `VITE_API_URL` và nối prefix `/api/v1` theo một quy ước duy nhất.
   - Gắn Bearer access token từ cơ chế session đã thống nhất.
   - Chuẩn hóa cách chuyển lỗi API về dạng FE dùng được; không nuốt lỗi.
   - Không tự retry request ghi dữ liệu khi chưa có chính sách an toàn.
2. Xây phần auth/session:
   - Trang đăng nhập và đổi mật khẩu bắt buộc.
   - Lưu/khôi phục session theo chính sách bảo mật nhóm thống nhất; không ghi token vào URL/log.
   - Protected routes theo `ADMIN`/`UNIT`, trạng thái chưa đăng nhập và `mustChangePassword`.
3. Xây shell giao diện chung:
   - Layout, menu theo role, loading/empty/error states, thông báo lỗi thành công và component form/table dùng chung.
4. Xây màn ADMIN quản lý tài khoản/đơn vị và cấu hình kỳ, phase, criteria, thresholds; hoàn thiện cấu hình trước khi công bố cho các cơ sở.
5. Xây dashboard ADMIN theo kỳ: tổng số 34 đơn vị (lấy từ API, không hard-code), phân biệt đơn vị chưa hoàn tất/đang tự chấm/chờ thẩm định/chờ bổ sung; leaderboard, phổ điểm và tiêu chí có nhiều đơn vị bị trừ điểm nhất.
6. Xây audit log để tra cứu người thao tác, đơn vị/tiêu chí liên quan, điểm cũ/mới và thời điểm; hiển thị sự kiện chuyển trạng thái tự động nếu API cung cấp.
7. Xây luồng tạo/tải báo cáo theo biểu mẫu: biên bản chi tiết từng đơn vị ra Word/PDF và bảng tổng hợp các đơn vị ra Excel.
8. Nếu backend cung cấp API cấu hình/theo dõi nhắc hạn, xây UI tương ứng; tác vụ gửi nhắc tự động và cấu hình kênh gửi thuộc backend, không chạy bằng timer của trình duyệt.

### Tiêu chí nghiệm thu

- Có thể đăng nhập/đăng xuất và hiển thị đúng role; session hết hạn được xử lý có thông báo rõ.
- Route ADMIN không được hiển thị cho UNIT; backend vẫn là nơi quyết định quyền cuối cùng.
- Form hiển thị lỗi validation theo field; danh sách có loading, empty, error và pagination khi API hỗ trợ.
- Form cấu hình chặn dữ liệu hiển nhiên không hợp lệ trước khi gửi, nhưng server response vẫn được xử lý.
- Dashboard phản ánh đúng tiến độ/trạng thái do server trả về, dùng đúng kỳ được chọn và có các chỉ số trong phạm vi API.
- Audit log thể hiện được người thao tác, thay đổi điểm cũ/mới, đơn vị/tiêu chí và thời gian khi dữ liệu được API cung cấp.
- Báo cáo đúng loại/định dạng theo chức năng; lỗi tạo hoặc tải báo cáo không bị báo thành công giả.

## FE 2 — Trọn luồng hồ sơ thi đua

### Nhiệm vụ

1. Xây trang UNIT:
   - Xem kỳ đang tham gia, phase, hạn tự chấm/hạn bổ sung và hồ sơ của đúng đơn vị.
   - Xem criteria/điểm tối đa/yêu cầu minh chứng; nhập `selfScore`/`selfNote`, theo dõi tổng điểm, phần trăm và xếp loại tạm tính do server trả về.
   - Upload nhiều ảnh JPG/PNG, PDF, Word hoặc thêm link ngoài; hiển thị tiến độ upload, lỗi từng file và khả năng retry phù hợp.
   - Xem ảnh/PDF preview; Word có thể tải xuống nếu backend chưa có preview converter.
   - Không thêm thao tác nộp hồ sơ riêng cho đợt tự chấm: khi hết hạn, hiển thị trạng thái khóa và chờ Admin thẩm định theo trạng thái server trả về.
   - Khi có yêu cầu bổ sung, làm rõ tiêu chí cần bổ sung và hạn 48 giờ tính từ yêu cầu; hiển thị deadline/thời gian còn lại theo dữ liệu server, khóa cập nhật khi hết hạn và theo dõi phản hồi/kết quả.
   - Xem điểm Admin, bình luận và điểm/phần trăm/xếp loại chính thức sau khi Admin chốt.
2. Xây trang ADMIN xử lý hồ sơ:
   - Danh sách/lọc hồ sơ theo kỳ và trạng thái.
   - Màn review side-by-side: tiêu chí/điểm tối đa, tự chấm, minh chứng, điểm Admin và ý kiến thẩm định; điểm Admin ban đầu hiển thị bằng điểm tự chấm nếu API trả về như vậy.
   - Khi đổi điểm, yêu cầu lý do/bình luận theo validation; chọn tiêu chí cụ thể chưa đạt để yêu cầu bổ sung/giải trình và theo dõi hạn 48 giờ.
   - Theo dõi phản hồi/lịch sử trạng thái, thẩm định lại sau bổ sung, chốt hồ sơ theo phase và hiển thị kết quả chính thức.
3. Xây các phần liên quan liền mạch với hồ sơ:
   - Feedback thread và status history theo quyền; thể hiện yêu cầu bổ sung thuộc tiêu chí nào và thời hạn áp dụng.
   - Notification inbox: danh sách/trạng thái đã đọc, nhắc hạn, phản hồi và yêu cầu bổ sung; điều hướng tới hồ sơ liên quan. Tại luồng ADMIN, hỗ trợ gửi thông báo gắn với hồ sơ/yêu cầu và theo dõi trạng thái khi API cung cấp.
   - Nút bật/tắt Web Push chỉ sau khi Auth/JWT và VAPID đã sẵn sàng; không yêu cầu quyền notification khi page tải.
   - Email/Web Push là kênh tùy chọn, chỉ hiển thị hoặc bật khi backend cấu hình và hỗ trợ; chức năng chính vẫn phải dùng được với thông báo trong hệ thống.

### Tiêu chí nghiệm thu

- UNIT chỉ thấy dữ liệu thuộc hồ sơ của mình; lỗi `403`/`404` từ backend được hiển thị an toàn, không làm lộ hồ sơ khác.
- Không hiển thị nút nộp riêng cho đợt tự chấm; việc khóa và chuyển chờ thẩm định phải theo status/deadline server, UI không tự quyết định thay backend.
- Chỉ cho cập nhật phần bổ sung được yêu cầu và trong thời hạn server cho phép; không cho cập nhật khi yêu cầu đã hết hạn/đóng.
- File upload có giới hạn/định dạng hiển thị trước khi gửi và xử lý upload một phần theo contract; không báo đã lưu metadata trước khi backend xác nhận.
- ADMIN thấy đủ minh chứng/điểm/nhận xét để thẩm định; chênh lệch điểm cần lý do theo validation backend.
- UNIT thấy kết quả chính thức sau khi chốt; ADMIN có thể thẩm định lại hồ sơ bổ sung và chốt theo phase.
- Sau thao tác cập nhật, yêu cầu bổ sung, thẩm định hoặc chốt, UI làm mới dữ liệu liên quan và thông báo lỗi nếu thao tác thất bại.

## Thứ tự phối hợp và tích hợp

1. **Chốt contract:**  Dùng [API contract](./API_CONTRACT.md) làm điểm bắt đầu; cập nhật khi có quyết định mới.
2. **Làm song song bằng mock:** FE 1 dựng API client/auth shell và mock dữ liệu cấu hình; FE 2 dựng hồ sơ UNIT/ADMIN từ cùng contract và mock. Không cần chờ tất cả API backend xong.
3. **Tích hợp nền tảng:** nối auth và API client trước với các API sẵn có; FE 2 dùng client chung, không tự tạo một cơ chế token/API khác.
4. **Tích hợp theo luồng:** auth → kỳ/criteria → tự chấm/minh chứng → tự khóa/chuyển chờ thẩm định khi hết hạn → review/bổ sung trong 48 giờ/chốt → dashboard, báo cáo, thông báo và audit log.
5. **Không chờ Web Push/upload converter:** hộp thư thông báo REST có thể làm trước; đăng ký Web Push và preview Word là phần sau, phụ thuộc auth/VAPID và worker tương ứng. Email/Zalo ZNS cũng chỉ tích hợp nếu backend cung cấp.
