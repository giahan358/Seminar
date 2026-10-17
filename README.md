# PROJECT ĐÁNH GIÁ KPI
## Tổng quan

| Thư mục | Mô tả |
|---|---|
| `docs/` | Tài liệu dự án và sơ đồ cơ sở dữ liệu (`.sql`). |
| `fe/` | Ứng dụng frontend sử dụng React, Vite và Ant Design. |
| `be/` | Backend sử dụng NestJS, PostgreSQL, Prisma, Supabase và Swagger. |

## Công nghệ

- **Frontend:** React 19, Vite, Ant Design, React Router, Axios.
- **Backend:** NestJS 11, Node.js, TypeScript, Swagger.
- **Cơ sở dữ liệu:** PostgreSQL 16, Prisma 7 (schema, client, migrations và seed).
- **Thông báo:** Web Push qua `web-push` ở backend; service worker ở frontend. Socket.IO không được dùng.
- **Xuất báo cáo:** `exceljs` cho Excel và `jspdf`/`jspdf-autotable` cho PDF ở frontend; `docx` ở backend để chuẩn bị tạo Word.
- **Upload:** NestJS `platform-express` cung cấp Multer middleware; API nhận/lưu file và preview minh chứng chưa được triển khai.
- **Lưu file:** Chưa tích hợp storage provider. Có thể chọn local storage cho phát triển hoặc Supabase Storage/object storage khi triển khai.

Các thư viện xuất file đã được cài nhưng chức năng tạo báo cáo chưa được xây dựng. Tương tự, Web Push đã có schema, API nền tảng và service worker nhưng cần tích hợp xác thực cùng các sự kiện nghiệp vụ trước khi dùng xuyên suốt.
## Mô hình tổ chức dự án

- **Frontend:** tổ chức kết hợp theo lớp dùng chung và nghiệp vụ. Các phần như `components/`, `hooks/`, `services/`, `routes/` là các lớp/tài nguyên dùng chung; `pages/` được chia theo nghiệp vụ như đánh giá, đề xuất KPI, báo cáo và người dùng.
- **Backend:** tổ chức theo **Modular Monolith** (ứng dụng đơn thể chia module nghiệp vụ). Mỗi module trong `src/modules/` phụ trách một nhóm chức năng; các thành phần dùng chung nằm trong `common/`, còn truy cập cơ sở dữ liệu được quản lý qua Prisma.

Mô hình này giúp frontend và backend phát triển độc lập trong cùng repository, đồng thời giữ các chức năng backend tách biệt theo nghiệp vụ mà chưa cần triển khai thành các microservice riêng.

## Frontend (`fe/`)

Frontend được tổ chức theo các trang nghiệp vụ, thành phần dùng chung và lớp gọi API.

```text
fe/
├── public/                    # Tài nguyên tĩnh công khai
├── src/
│   ├── assets/                # Hình ảnh, biểu tượng và tài nguyên tĩnh
│   ├── components/
│   │   ├── common/            # Table, Modal, Button bọc Ant Design
│   │   └── exports/           # Thành phần hỗ trợ xuất PDF/Excel
│   ├── config/                # Cấu hình theme Ant Design và constants
│   ├── contexts/              # Auth, Socket và Theme Context
│   ├── hooks/                 # Custom hooks như useAuth, useSocket
│   ├── layouts/               # MainLayout, AdminLayout, AuthLayout
│   ├── pages/
│   │   ├── auth/              # Đăng nhập, đổi mật khẩu
│   │   ├── dashboard/         # Trang tổng quan KPI
│   │   ├── evaluations/       # Tự đánh giá, đánh giá đơn vị
│   │   ├── kpi-proposals/     # Đề xuất KPI
│   │   ├── reports/           # Báo cáo và xuất Excel/PDF
│   │   └── users/             # Quản lý người dùng, phòng ban và RBAC
│   ├── routes/                # React Router và Protected Routes (RBAC)
│   ├── services/              # Các lời gọi API bằng Axios
│   ├── sockets/               # Socket.io client listeners
│   ├── utils/                 # Tiện ích xuất Excel (ExcelJS), PDF (jsPDF)
│   ├── App.jsx
│   └── main.jsx
├── .env                       # Biến môi trường frontend
├── package.json
└── vite.config.js
```

### Thứ tự code một tính năng ở frontend

**Thứ tự chuẩn React:** Service (API) → Custom Hook → Page → Sub-Components → Route. Cách làm này hoàn thiện tầng giao tiếp dữ liệu trước khi dựng UI, giúp hạn chế phải sửa giao diện nhiều lần.

Ví dụ thêm trang **danh sách đề xuất KPI**, code theo thứ tự:

1. **`src/services/kpiProposalService.js`** — viết hàm gọi API, ví dụ `getKpiProposals()`.
2. **`src/hooks/useKpiProposals.js`** *(nếu cần)* — gọi service và quản lý trạng thái dữ liệu, loading, error khi logic cần dùng lại.
3. **`src/pages/kpi-proposals/KpiProposalListPage.jsx`** — gọi hook hoặc service, nhận danh sách đề xuất và dựng nội dung trang.
4. **`src/components/`** *(nếu cần)* — tách bảng đề xuất hoặc phần giao diện dùng lại thành component.
5. **`src/routes/`** — thêm URL cho trang và cấu hình quyền truy cập nếu cần.

**Luồng chạy:** Người dùng mở URL → `routes/` hiển thị page → page/hook gọi service → service gọi API BE → dữ liệu trả về page → page hiển thị bằng component. `layouts/` bọc trang; `contexts/` giữ trạng thái dùng chung; `sockets/` xử lý cập nhật realtime. Chỉ sửa `App.jsx`/`main.jsx` khi cần đăng ký route hoặc provider toàn ứng dụng.

Các thư mục hỗ trợ: `config/` chứa cấu hình/constants; `utils/` chứa hàm tiện ích; `assets/` và `public/` chứa tài nguyên; `.env` chứa cấu hình môi trường frontend; `package.json` quản lý scripts/dependencies; `vite.config.js` cấu hình Vite. Không đưa secret vào biến môi trường được đóng gói ở frontend.

## Backend (`be/`)

Backend chia module theo nghiệp vụ và bảng dữ liệu, sử dụng Prisma để quản lý schema và migration.

```text
be/
├── prisma/
│   ├── schema.prisma          # Định nghĩa model cơ sở dữ liệu
│   ├── seed.ts                # Dữ liệu mẫu: Admin, 34 đơn vị, kỳ thi đua và ngưỡng xếp loại
│   └── migrations/            # Lịch sử thay đổi schema
├── src/
│   ├── common/
│   │   ├── decorators/        # Decorator dùng chung: @Roles(), @CurrentUser()
│   │   ├── guards/            # JwtAuthGuard, RolesGuard (RBAC)
│   │   ├── interceptors/      # TransformResponse, Logging
│   │   └── utils/             # Tiện ích tạo PDF/Excel
│   ├── config/                # Cấu hình môi trường, Supabase, Swagger
│   ├── prisma/                # Prisma module và service
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── modules/
│   │   ├── auth/              # Đăng nhập, refresh token, JWT strategy
│   │   │   └── dto/           # LoginDto, RegisterDto (Swagger)
│   │   ├── users/             # Quản lý người dùng và phòng ban
│   │   ├── evaluation-periods/ # Đợt đánh giá và ngưỡng xếp loại
│   │   ├── evaluations/       # Phiếu đánh giá, điểm chung và tổng hợp
│   │   ├── kpis/              # KPI assignments, standard KPIs, scores
│   │   ├── kpi-proposals/     # Đề xuất KPI và duyệt đề xuất
│   │   ├── evidences/         # Minh chứng và dịch vụ lưu trữ Supabase
│   │   ├── exports/           # Xuất báo cáo tổng hợp Excel/PDF
│   │   ├── notifications/     # REST API, Web Push subscriptions và Dispatcher
│   │   └── audit-logs/        # Ghi lịch sử hoạt động hệ thống
│   ├── app.module.ts
│   └── main.ts                # Khởi tạo ứng dụng và Swagger DocumentBuilder
├── .env                       # Biến môi trường backend
├── nest-cli.json
└── package.json
```

### Thứ tự code một tính năng ở backend

**Thứ tự chuẩn NestJS + Prisma:** Schema → Migration → DTO → Service → Controller → Module. Đây là trình tự tự nhiên vì các lớp sau phụ thuộc vào lớp trước: Controller gọi Service, còn Service xử lý nghiệp vụ và dùng Prisma để truy cập dữ liệu.

Ví dụ tạo API **lấy danh sách đề xuất KPI**:

1. **`prisma/schema.prisma`** *(chỉ khi cần bảng/field mới)* — khai báo cấu trúc dữ liệu.
2. **`prisma/migrations/`** *(khi thay đổi schema)* — tạo migration để cập nhật database.
3. **`src/modules/kpi-proposals/dto/`** *(khi API có input cần kiểm tra)* — định nghĩa DTO và validation.
4. **`src/modules/kpi-proposals/kpi-proposals.service.ts`** — viết nghiệp vụ; gọi `PrismaService` để đọc danh sách đề xuất.
5. **`src/modules/kpi-proposals/kpi-proposals.controller.ts`** — khai báo endpoint `GET /kpi-proposals`, nhận request và gọi service. Controller không truy vấn database trực tiếp.
6. **`src/modules/kpi-proposals/kpi-proposals.module.ts`** — đăng ký controller/service và dependency của module.
7. **`src/app.module.ts`** *(nếu module chưa được đăng ký)* — thêm module vào ứng dụng.
8. **`prisma/seed.ts`** *(nếu cần dữ liệu mẫu)* — thêm dữ liệu phục vụ phát triển/thử nghiệm.

**Luồng request/response đầy đủ:** `KpiProposalListPage.jsx` → `kpiProposalService.js` → `KpiProposalsController` → `KpiProposalsService` → `PrismaService` → PostgreSQL → trả kết quả ngược lại theo cùng chuỗi để page hiển thị.

Nói ngắn gọn: **Controller nhận request và chuyển việc cho Service; Service xử lý nghiệp vụ và gọi database.** DTO kiểm tra dữ liệu đầu vào. `common/guards/` kiểm tra đăng nhập/phân quyền; `common/interceptors/` xử lý request/response dùng chung. Chỉ sửa `main.ts` hoặc `config/` khi cần thay đổi cấu hình toàn ứng dụng.
