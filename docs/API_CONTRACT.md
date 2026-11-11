# API Contract — Hệ thống đánh giá thi đua Đoàn

Tài liệu này chuyển đặc tả ở [danh sách api.md](./danh%20s%C3%A1ch%20api.md) thành các hợp đồng request/response mẫu để frontend và backend phát triển song song.

> **Quy ước tên field:** Request/response API dùng `camelCase` nhất quán. Tên cột PostgreSQL có thể tiếp tục dùng `snake_case`; Prisma ánh xạ giữa field code và cột DB.

## 1. Quy ước chung

- Request có body gửi `Content-Type: application/json`; upload trực tiếp dùng HTTP method và headers do signed URL trả về.
- Endpoint cần đăng nhập gửi `Authorization: Bearer <accessToken>`.
- Không nhận identity/phân quyền do client tự khai báo. Không trả `passwordHash`, `tokenHash`, access token của người khác, private key hoặc storage credentials.
- Giá trị do hệ thống quyết định như `actorId`, `createdById`, `reviewedById`, `unitId` của người UNIT, trạng thái chuyển tiếp và thời gian xử lý phải lấy từ token/quy tắc backend.

### Danh tính hiện tại

Sau khi xác thực access token, backend cung cấp cho các controller một danh tính tương đương:

```ts
type CurrentUser = {
  id: string;
  role: "ADMIN" | "UNIT";
  unitId: string | null;
};
```

- `UNIT`: `unitId` là đơn vị duy nhất của tài khoản; mọi truy vấn hồ sơ phải giới hạn theo đơn vị này.
- `ADMIN`: `unitId` là `null`; quyền quản trị vẫn phải được kiểm tra server-side.
- Đây là kiểu nội bộ backend, không phải object client được phép gửi để tự nhận quyền.

### Phân trang danh sách

Query params: `page` mặc định `1`; `pageSize` mặc định `20`, tối đa `100`.

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

### Lỗi

Tất cả lỗi API dùng cấu trúc thống nhất:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu gửi lên không hợp lệ",
  "details": [
    {
      "field": "selfScore",
      "messages": ["Điểm phải nằm trong khoảng cho phép."]
    }
  ]
}
```

Luôn có đủ `statusCode`, `code`, `message`, `details`; `details` là mảng rỗng khi không có lỗi trường. Mỗi phần tử có `field: string` và `messages: string[]`; đường dẫn lồng nhau dùng dấu chấm, ví dụ `thresholds.0.minPercent` (mảng body gốc dùng `0.minPercent`). FE dựa vào `code`/`field`, không dựa vào nội dung câu tiếng Việt để điều khiển logic.

Field ngoài DTO bị từ chối với `400 VALIDATION_ERROR`. JSON hỏng, pipe UUID/số/enum, multipart sai và route không tồn tại đều trả câu tiếng Việt an toàn. Không phản chiếu giá trị nhập, URL, tên bảng/cột, SQL, stack hoặc phản hồi provider. Lỗi unique trả 409; bản ghi không còn tồn tại trả 404; CHECK/trigger đã nhận diện trả 422 `DB_RULE_VIOLATION`; lỗi DB chưa nhận diện trả 500, mất kết nối trả 503 `DATABASE_UNAVAILABLE`.

Câu chính thức theo mã nằm ở [danh mục lỗi](../be/src/common/constants/error-messages.ts). Filter dùng danh mục này thay cho thông điệp thô; chỉ nhận `details` từ payload có mã nội bộ đã công bố. Các lỗi trường từ DTO giữ câu cụ thể bằng tiếng Việt. Thêm mã nghiệp vụ mới phải cập nhật contract và danh mục trước khi dùng.

Swagger tại `/api/docs-json` mô tả đủ bốn trường và các lỗi framework cho mọi operation. Chỉ xuất tệp OpenAPI khi cấu hình `OPENAPI_OUTPUT_FILE`; mặc định không tự ghi đè tài liệu đang chỉnh sửa.

### Kiểu dữ liệu phản hồi

Ngày giờ trả ISO 8601 UTC có hậu tố `Z`. Điểm Prisma Decimal trả JSON number, làm tròn hai chữ số bằng ROUND_HALF_UP. BigInt trong khoảng số nguyên an toàn của JavaScript trả number; ngoài khoảng đó trả chuỗi số thập phân để không mất chính xác. Không thay đổi chuỗi văn bản chỉ vì có dạng số.

| HTTP | Dùng khi |
|---|---|
| `400` | Thiếu/sai định dạng field hoặc query. |
| `401` | Chưa đăng nhập, access token sai/hết hạn. |
| `403` | Đã đăng nhập nhưng không có quyền. |
| `404` | Không tìm thấy tài nguyên hoặc tài nguyên ngoài phạm vi được phép xem. |
| `409` | Trùng dữ liệu hoặc xung đột trạng thái hiện tại. |
| `405` | Phương thức HTTP không được hỗ trợ nếu adapter phân biệt với 404. |
| `413` | Body hoặc tệp vượt dung lượng cho phép. |
| `415` | Kiểu nội dung không được hỗ trợ. |
| `422` | Request đúng cấu trúc nhưng vi phạm điều kiện nghiệp vụ. |
| `500` | Lỗi không dự kiến; không trả stack trace/secret. |
| `503` | Dịch vụ hoặc cơ sở dữ liệu tạm thời không khả dụng. |

## 2. Xác thực, tài khoản và đơn vị

### Đăng nhập

`POST /auth/login` — public.

Request:

```json
{
  "username": "coso01",
  "password": "example-password"
}
```

`200 OK`:

```json
{
  "accessToken": "<access-token>",
  "refreshToken": "<refresh-token>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "username": "coso01",
    "fullName": "Cơ sở demo 01",
    "role": "UNIT",
    "unitId": "22222222-2222-4222-8222-222222222222",
    "mustChangePassword": true
  }
}
```

Sai username/password trả `401` với `code = INVALID_CREDENTIALS`; không cho biết riêng username hay password sai.
Response refresh token chỉ trả cho lần đăng nhập này; backend chỉ lưu SHA-256 hash của refresh token, không lưu token thô.

### Thông tin người dùng hiện tại

`GET /auth/me` — cần access token Bearer.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "username": "coso01",
  "fullName": "Cơ sở demo 01",
  "role": "UNIT",
  "unitId": "22222222-2222-4222-8222-222222222222",
  "mustChangePassword": true
}
```

Response chỉ chứa hồ sơ an toàn của user hiện tại, không chứa password hash hoặc token.

### Làm mới access token

`POST /auth/refresh` — public; refresh token là chuỗi opaque đã được lưu hash ở backend. Refresh token cũ bị thu hồi sau khi dùng thành công.

Request:

```json
{
  "refreshToken": "<refresh-token>"
}
```

`200 OK` trả cặp access/refresh token mới cùng `tokenType`, `expiresIn` và `user` theo response đăng nhập. Token không hợp lệ, hết hạn hoặc đã dùng trả `401 INVALID_REFRESH_TOKEN`.

### Đăng xuất

`POST /auth/logout` — public; thu hồi refresh token được gửi lên. Thao tác thu hồi lặp lại vẫn trả thành công để hỗ trợ logout idempotent.

Request:

```json
{
  "refreshToken": "<refresh-token>"
}
```

`200 OK`:

```json
{
  "success": true
}
```

### Đổi mật khẩu

`POST /auth/change-password` — cần access token Bearer.

Request:

```json
{
  "currentPassword": "current-password",
  "newPassword": "new-password"
}
```

Backend xác minh mật khẩu hiện tại; sai mật khẩu trả `400 VALIDATION_ERROR`, `details.field=currentPassword`, thông báo “Mật khẩu hiện tại không chính xác.”
Mật khẩu mới tối thiểu 10 ký tự, có chữ và số, tối đa 72 byte UTF-8, khác username (không phân biệt hoa thường), khác mật khẩu cũ khi so bcrypt và không thuộc danh sách phổ biến của policy
Thành công cập nhật hash/cờ/version, thu hồi mọi refresh cũ và trả cặp token mới theo response login, tất cả trong cùng transaction; FE lưu thay cặp token cũ

Quy tắc VC02 áp dụng cho cả năm endpoint:
- Login username 3–64 ký tự sau trim, password 1–128 ký tự; tài khoản/đơn vị khóa dùng chung `401 INVALID_CREDENTIALS`
- Access mặc định 900 giây, refresh 604800 giây qua `JWT_ACCESS_TTL`/`JWT_REFRESH_TTL`; refresh ngẫu nhiên 48 byte, DB chỉ lưu SHA-256
- JWT chỉ HS256, kiểm issuer/audience/tokenUse/sub UUID/exp và claim `ver` bằng `User.credentialVersion`; token cũ thiếu version buộc đăng nhập lại sau rollout
- Refresh xoay trong transaction có khóa user; tái dùng token đã thu hồi sẽ thu hồi mọi refresh của user và commit trước khi trả `401 INVALID_REFRESH_TOKEN`, kể cả request cạnh tranh
- Tài khoản còn cờ chỉ dùng access cho me/change-password; logout xác minh bằng chính refresh token được gửi, idempotent; refresh bị từ chối `403 PASSWORD_CHANGE_REQUIRED`
- Guard JWT lấy DB rồi kiểm cờ đổi mật khẩu ngay trong cùng guard trước RolesGuard; whitelist dùng metadata chỉ trên me/change-password, không dựa vào URL do client gửi
- Me trả thêm `unit: {id, code, name, unitType} | null`, không trả version/hash
- Audit LOGIN_SUCCESS/LOGIN_FAILED/PASSWORD_CHANGED chỉ ghi định danh và IP từ request server, không tin X-Forwarded-For khi chưa cấu hình proxy tin cậy

### Các API tài khoản/đơn vị

Các route `GET/PATCH /users/:id`, `GET/POST/PATCH /units`, `GET /units/:id/users` dùng JSON field theo schema và theo allowlist của từng vai trò. `POST /users` không nhận `passwordHash`; response chỉ trả dữ liệu hồ sơ được phép hiển thị. UNIT không được thay đổi role hoặc unit của chính mình. Request/response chi tiết cần được chốt khi nhóm thiết kế từng màn quản trị; không tự map toàn bộ cột DB thành API.

## 3. Đợt thi đua, ngưỡng và tiêu chí

### Tạo đợt

`POST /evaluation-periods` — ADMIN.

Request:

```json
{
  "year": 2026,
  "name": "Thi đua Công tác Đoàn năm 2026",
  "maxTotalScore": 300,
  "selfEvalStart": "2026-10-01T00:00:00.000Z",
  "selfEvalDeadline": "2026-10-31T16:59:00.000Z",
  "supplementHours": 48
}
```

Backend lấy `createdById` từ CurrentUser, phase ban đầu là `SETUP`.

`201 Created`:

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "year": 2026,
  "name": "Thi đua Công tác Đoàn năm 2026",
  "phase": "SETUP",
  "maxTotalScore": 300,
  "selfEvalStart": "2026-10-01T00:00:00.000Z",
  "selfEvalDeadline": "2026-10-31T16:59:00.000Z",
  "supplementHours": 48
}
```

### Cấu hình tiêu chí

`POST /evaluation-periods/:periodId/criteria` — ADMIN.

```json
{
  "parentId": null,
  "code": "1",
  "name": "Công tác tuyên truyền",
  "description": "Nội dung đánh giá",
  "maxScore": 10,
  "evidenceRequirement": "Nộp báo cáo hoặc đường dẫn bài viết",
  "allowText": true,
  "allowFile": true,
  "allowLink": true,
  "evidenceRequired": true,
  "sortOrder": 1
}
```

Response `201 Created`: resource tiêu chí đã lưu, gồm `id`, `periodId` và các field cấu hình; `createdAt`/`updatedAt` do server cấp. Cập nhật/xóa dùng các route tiêu chí trong API catalog và cùng response shape.

## 4. Hồ sơ, điểm và minh chứng

### Đọc hồ sơ

`GET /evaluations/:evaluationId` — ADMIN hoặc UNIT sở hữu hồ sơ.

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "periodId": "33333333-3333-4333-8333-333333333333",
  "unit": {
    "id": "22222222-2222-4222-8222-222222222222",
    "code": "COSO-DEMO-01",
    "name": "Cơ sở demo 01"
  },
  "status": "DRAFT",
  "submittedAt": null,
  "supplementDeadline": null,
  "criteria": [
    {
      "criterionId": "55555555-5555-4555-8555-555555555555",
      "code": "1.1",
      "name": "Tiêu chí mẫu",
      "maxScore": 10,
      "selfScore": null,
      "selfNote": null,
      "adminScore": null,
      "adminComment": null,
      "needsSupplement": false,
      "evidences": []
    }
  ]
}
```

UNIT chỉ nhận hồ sơ đơn vị của mình. Có thể trả thêm các field cần thiết cho UI, nhưng không trả dữ liệu nhạy cảm hoặc dữ liệu đơn vị khác.

### Lưu điểm tự chấm

`PUT /evaluations/:evaluationId/scores/:criterionId/self` — UNIT sở hữu hồ sơ.

Request:

```json
{
  "selfScore": 8,
  "selfNote": "Đã tổ chức hoạt động theo kế hoạch."
}
```

`200 OK`:

```json
{
  "evaluationId": "44444444-4444-4444-8444-444444444444",
  "criterionId": "55555555-5555-4555-8555-555555555555",
  "selfScore": 8,
  "selfNote": "Đã tổ chức hoạt động theo kế hoạch.",
  "updatedAt": "2026-10-17T08:30:00.000Z"
}
```

`selfScore` phải từ `0` đến `maxScore`; backend không nhận `unitId`, `adminScore`, trạng thái hoặc `reviewedById` từ UNIT.

### Upload nhiều file và link ngoài

1. Frontend xin signed URLs:

`POST /evaluations/:evaluationId/evidences/upload-urls` — UNIT sở hữu hồ sơ.

```json
{
  "items": [
    {
      "criterionScoreId": "66666666-6666-4666-8666-666666666666",
      "fileName": "bao-cao.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 125000,
      "round": "INITIAL"
    },
    {
      "criterionScoreId": "66666666-6666-4666-8666-666666666666",
      "fileName": "hoat-dong.png",
      "mimeType": "image/png",
      "sizeBytes": 280000,
      "round": "INITIAL"
    }
  ]
}
```

`200 OK`:

```json
{
  "items": [
    {
      "uploadUrl": "https://storage.example/signed-upload",
      "method": "PUT",
      "requiredHeaders": {
        "Content-Type": "application/pdf"
      },
      "storagePath": "private/evaluations/random-object-key.pdf",
      "expiresAt": "2026-10-17T08:45:00.000Z"
    }
  ]
}
```

Response `items` có một phần tử tương ứng cho mỗi item trong request. Upload bytes trực tiếp lên từng `uploadUrl` theo `method`/headers. Bucket phải private; `storagePath` do server tạo và không được client tự chọn.

2. Sau khi upload thành công, ghi metadata minh chứng:

`POST /evaluations/:evaluationId/evidences` — UNIT sở hữu hồ sơ.

```json
{
  "items": [
    {
      "kind": "FILE",
      "criterionScoreId": "66666666-6666-4666-8666-666666666666",
      "storagePath": "private/evaluations/random-object-key.pdf",
      "fileName": "bao-cao.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 125000,
      "round": "INITIAL",
      "description": "Báo cáo tổng kết hoạt động"
    },
    {
      "kind": "LINK",
      "criterionScoreId": "66666666-6666-4666-8666-666666666666",
      "externalUrl": "https://example.org/hoat-dong",
      "round": "INITIAL",
      "description": "Bài viết hoạt động"
    }
  ]
}
```

`201 Created`:

```json
{
  "items": [
    {
      "id": "77777777-7777-4777-8777-777777777777",
      "kind": "FILE",
      "fileName": "bao-cao.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 125000,
      "round": "INITIAL",
      "previewStatus": "NOT_REQUIRED",
      "createdAt": "2026-10-17T08:30:00.000Z"
    }
  ]
}
``

Đọc minh chứng dùng `GET /evaluations/:evaluationId/evidences/:evidenceId`; preview dùng `GET /evaluations/:evaluationId/evidences/:evidenceId/preview`. Response cung cấp metadata và signed URL có thời hạn; ảnh/PDF mở inline, Word tải xuống trừ khi worker tạo preview PDF. Không trả bucket private hoặc storage credentials.

## 5. Thẩm định, bổ sung và trạng thái

### Admin chấm một tiêu chí

`PUT /admin/evaluations/:evaluationId/scores/:criterionId/review` — ADMIN.

```json
{
  "adminScore": 6,
  "adminComment": "Trừ 2 điểm do minh chứng chưa thể hiện đủ nội dung.",
  "needsSupplement": true,
  "supplementNote": "Vui lòng bổ sung báo cáo chi tiết."
}
```

`200 OK`:

```json
{
  "evaluationId": "44444444-4444-4444-8444-444444444444",
  "criterionId": "55555555-5555-4555-8555-555555555555",
  "adminScore": 6,
  "adminComment": "Trừ 2 điểm do minh chứng chưa thể hiện đủ nội dung.",
  "needsSupplement": true,
  "reviewedAt": "2026-10-17T08:30:00.000Z"
}
```

`adminComment` bắt buộc nếu điểm Admin khác điểm tự chấm. Người duyệt lấy từ CurrentUser.

### Yêu cầu bổ sung

`POST /admin/evaluations/:evaluationId/supplement-request` — ADMIN.

```json
{
  "criterionIds": [
    "55555555-5555-4555-8555-555555555555"
  ],
  "content": "Vui lòng bổ sung minh chứng cho tiêu chí được nêu."
}
```

`200 OK`:

```json
{
  "evaluationId": "44444444-4444-4444-8444-444444444444",
  "status": "SUPPLEMENT_REQUESTED",
  "supplementDeadline": "2026-10-19T08:30:00.000Z",
  "feedbackId": "88888888-8888-4888-8888-888888888888"
}
```

Thời hạn được tính bởi server theo cấu hình kỳ, không tin giờ deadline do client tự truyền. Luồng gửi bổ sung dùng `POST /evaluations/:evaluationId/supplement-submit` với body `{}`; backend xác thực deadline, đổi trạng thái, ghi lịch sử và phản hồi.

### State machine hồ sơ

| Chuyển trạng thái | Người/tác vụ | Điều kiện chính |
|---|---|---|
| `DRAFT` → `PENDING_REVIEW` | UNIT nộp hoặc scheduler auto-lock | Đợt mở tự chấm; còn hạn khi UNIT nộp; scheduler ghi `autoLockedAt`. |
| `PENDING_REVIEW` → `SUPPLEMENT_REQUESTED` | ADMIN | Có tiêu chí được yêu cầu bổ sung và deadline do server tính. |
| `SUPPLEMENT_REQUESTED` → `SUPPLEMENT_SUBMITTED` | UNIT | Chỉ bổ sung tiêu chí được yêu cầu, trước deadline. |
| `SUPPLEMENT_REQUESTED` → `SUPPLEMENT_EXPIRED` | Scheduler | Deadline đã hết. |
| Trạng thái chờ thẩm định hợp lệ → `FINALIZED` | ADMIN | Đợt ở `FINAL_REVIEW`; server tính và lưu điểm/xếp loại chính thức. |

Mọi chuyển trạng thái phải cập nhật hồ sơ, `statusHistories` và audit/thông báo liên quan trong transaction phù hợp. Không có API tổng quát cho client tự đặt status.

## 6. Phản hồi, lịch sử, thông báo và audit

Zalo ZNS là tích hợp tùy chọn có phí, mặc định `ZALO_ZNS_ENABLED=false`; phạm vi đồ án chỉ chuẩn bị cấu hình và điểm mở rộng, không yêu cầu demo gửi thật hoặc tài khoản trả phí
Chỉ kích hoạt sau khi doanh nghiệp yêu cầu và cung cấp tài khoản/OA/quyền/token/template hợp lệ cùng môi trường/người nhận được chỉ định
Khi tắt, không gọi API Zalo, không tạo công việc gửi/retry ZNS, không yêu cầu secret; UI/báo cáo ghi “Chưa kích hoạt” hoặc “Đã tắt theo cấu hình”, không báo SENT hoặc lỗi gửi
Các kết quả tổng hợp như `allRequiredChannelsSent` chỉ tính kênh đang bật và được yêu cầu, không dùng ZNS chưa kích hoạt để chặn nghiệm thu Email/Push


- `POST /evaluations/:evaluationId/feedback` request:

  ```json
  {
    "type": "UNIT_REPLY",
    "content": "Đơn vị đã bổ sung tài liệu theo yêu cầu."
  }
  ```

  Backend tự đặt `authorId` từ CurrentUser. Response `201 Created` gồm `id`, `evaluationId`, `authorId`, `type`, `content`, `createdAt`.
- `GET /evaluations/:evaluationId/feedback` trả `{ "items": [...] }`, chỉ với người có quyền trên hồ sơ.
- `GET /evaluations/:evaluationId/status-history` trả `{ "items": [{ "fromStatus": "DRAFT", "toStatus": "PENDING_REVIEW", "actorId": "...", "comment": null, "createdAt": "..." }] }`; actor null biểu thị tác vụ hệ thống.
- `GET /notifications` trả dạng phân trang chung; query `isRead=true|false`.
- `PATCH /notifications/:notificationId/read` response: `{ "isRead": true }`.
- `POST /notifications/read-all` response: `{ "updated": 3 }`.
- `GET /notifications/web-push/public-key` public; response `{ "publicKey": "<VAPID-public-key>" }`.
- `POST /notifications/web-push/subscriptions` nhận object `PushSubscription` của trình duyệt; server gắn user từ token, response metadata subscription, không trả private key.
- `DELETE /notifications/web-push/subscriptions/current` nhận `{ "endpoint": "https://push-service.example/..." }`; response `{ "revoked": true }`.
- Audit log chỉ ADMIN đọc; thao tác ghi audit nội bộ không nhận actor tùy ý từ client.

## 7. Dashboard và xuất báo cáo

### Dashboard

`GET /admin/dashboard?periodId=<UUID>` — ADMIN.

```json
{
  "periodId": "33333333-3333-4333-8333-333333333333",
  "totalUnits": 34,
  "submittedCount": 12,
  "notSubmittedCount": 18,
  "supplementPendingCount": 4,
  "progressPercent": 35.29
}
```

Leaderboard, score distribution và criteria deductions trả JSON theo dữ liệu view SQL, luôn kèm `periodId`. Shape chi tiết của chart dataset cần được nhóm FE/BE chốt theo loại biểu đồ trước khi triển khai trang dashboard.

### Tạo và tải báo cáo

`POST /admin/reports/exports` — ADMIN.

Bảng tổng hợp:

```json
{
  "periodId": "33333333-3333-4333-8333-333333333333",
  "reportType": "SUMMARY_ALL_UNITS",
  "format": "XLSX"
}
```

Biên bản thẩm định một đơn vị:

```json
{
  "periodId": "33333333-3333-4333-8333-333333333333",
  "evaluationId": "44444444-4444-4444-8444-444444444444",
  "reportType": "UNIT_APPRAISAL_MINUTES",
  "format": "PDF"
}
```

`201 Created`:

```json
{
  "id": "99999999-9999-4999-8999-999999999999",
  "periodId": "33333333-3333-4333-8333-333333333333",
  "evaluationId": null,
  "reportType": "SUMMARY_ALL_UNITS",
  "format": "XLSX",
  "createdAt": "2026-10-17T08:30:00.000Z",
  "downloadUrl": "/api/v1/admin/reports/exports/99999999-9999-4999-8999-999999999999/download"
}
```

Format hợp lệ: tổng hợp 34 đơn vị → `XLSX`; biên bản từng đơn vị → `PDF` hoặc `DOCX`. Evaluation phải thuộc `periodId` được gửi. `GET /admin/reports/exports` trả danh sách phân trang; `GET /admin/reports/exports/:exportId/download` xác minh ADMIN và trả redirect/file hoặc signed URL có thời hạn, không lộ storage path.


## VC03 — Giao ước lưu trữ bổ sung

Không thêm endpoint hoặc đổi response ở VC03, các bảng mới là nền tảng cho VC05–VC12

- ImportSession thuộc admin, rows JSON chuẩn hóa không chứa mật khẩu, digest SHA-256, unique admin/idempotencyKey, trạng thái PREVIEW/CONFIRMED/EXPIRED, result và confirmedAt chỉ có sau xác nhận
- OnboardingToken chỉ purpose PUSH_REGISTRATION, hash SHA-256 unique, user/version, expiresAt bắt buộc, usedAt nullable cho token chưa dùng
- CredentialDispatch unique user/version, ciphertext/nonce/tag/keyId AES-256-GCM bắt buộc, không lưu mật khẩu thô, hết hạn hoặc đã hủy thì không gửi
- CredentialDelivery chỉ WEB_PUSH/EMAIL/ZALO_ZNS, trạng thái PENDING/SENT/FAILED/SKIPPED, unique dispatch/channel, attemptCount không âm, reasonCode phân biệt NO_SUBSCRIPTION
- Lease gồm claimedAt/leaseUntil/claimToken cùng null hoặc cùng có giá trị và leaseUntil lớn hơn claimedAt, áp dụng cả NotificationDelivery và ZaloConnection
- Giữ dữ liệu TELEGRAM cũ, nghiệp vụ mới chỉ dùng ba kênh chính thức, ZNS vẫn mặc định tắt
- ZaloConnection unique oaId, token mã hóa, tokenVersion không âm, expiresAt bắt buộc, không yêu cầu secret để tạo schema
- CriterionScore.supplementedAt nullable, chỉ ghi khi có thay đổi tự chấm/minh chứng thực trong vòng bổ sung, không backfill từ updatedAt
- Timestamp giữ UTC, FK NoAction, TTL phải kiểm trong service/worker, không tự xóa dữ liệu khi hết hạn
- Trigger dùng SQLSTATE 23514 và CONSTRAINT làm rule identifier ổn định, response vẫn DB_RULE_VIOLATION tiếng Việt, không trả raw driver
- DRAFT chỉ được sửa trong [selfEvalStart,selfEvalDeadline) của kỳ đã publish, bổ sung chỉ trước supplementDeadline, đúng deadline bị khóa kể cả job trễ
