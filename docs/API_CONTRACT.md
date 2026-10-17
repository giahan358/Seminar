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
      "message": "Điểm phải nằm trong khoảng cho phép."
    }
  ]
}
```

`details` có thể là mảng rỗng. FE dựa vào `code`/`field`, không dựa vào nội dung câu tiếng Việt để điều khiển logic.

| HTTP | Dùng khi |
|---|---|
| `400` | Thiếu/sai định dạng field hoặc query. |
| `401` | Chưa đăng nhập, access token sai/hết hạn. |
| `403` | Đã đăng nhập nhưng không có quyền. |
| `404` | Không tìm thấy tài nguyên hoặc tài nguyên ngoài phạm vi được phép xem. |
| `409` | Trùng dữ liệu hoặc xung đột trạng thái hiện tại. |
| `422` | Request đúng cấu trúc nhưng vi phạm điều kiện nghiệp vụ. |
| `500` | Lỗi không dự kiến; không trả stack trace/secret. |

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

Backend xác minh mật khẩu hiện tại, áp chính sách độ dài/độ mạnh đã thống nhất, đặt `mustChangePassword` thành `false` và thu hồi các refresh token cũ của user. Request sai mật khẩu trả `401 INVALID_CREDENTIALS`; mật khẩu mới không đạt chính sách trả `400 VALIDATION_ERROR`. Thành công trả hồ sơ user an toàn theo shape `/auth/me`; client cần đăng nhập lại nếu session hiện tại bị thu hồi.

> **Trạng thái triển khai:** `POST /auth/login` và `GET /auth/me` đã được triển khai bước đầu, gồm Bearer-token guard và kiểm tra role dùng được cho các module khác. `POST /auth/refresh`, `POST /auth/logout` và `POST /auth/change-password` vẫn là contract cho các bước tiếp theo, chưa được coi là đã triển khai cho đến khi endpoint tương ứng được hoàn tất và kiểm thử.

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
