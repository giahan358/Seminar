# Hướng dẫn clone và chạy backend

Hướng dẫn này dành cho môi trường phát triển local trên Windows với PowerShell.

## Yêu cầu

- Node.js `20.19.0` trở lên và npm
- Docker Desktop đang chạy

- Cách tìm tài khoản admin và 34 tài khoản con để test POST/auth/login:
vào file .env của folder be, thêm dòng :
```
SEED_CREDENTIALS_FILE=admin-credentials.json
```
- Nhấn save-> Vào File Explorer vào vị trí chứa folder của project seminar sẽ thấy 1 file tên seed-credentials.json chứa thông tin tài khoản (nó không xuất hiện trong danh sách project của vs code)

## Lần đầu clone project

Trong lần đầu, làm các bước dưới đây để chuẩn bị PostgreSQL/backend. **Chưa cần seed dữ liệu mẫu hoặc cấu hình VAPID để chỉ khởi động backend**; các bước tùy chọn này được gom ở cuối tài liệu. Sau đó làm theo [hướng dẫn frontend](./FE_GETTING_STARTED.md) để chạy FE.


## 2. Cấu hình backend

Tạo file `.env` ở thư mục gốc để Docker Compose đọc cấu hình PostgreSQL:

```powershell
Copy-Item .env.example .env
```

Mở `.env` và thay `POSTGRES_PASSWORD` bằng mật khẩu local của bạn. File `.env` đã nằm trong `.gitignore`; chỉ commit `.env.example`, không commit `.env`.

Tạo file môi trường backend từ file mẫu:

```powershell
Copy-Item be\.env.example be\.env
```

Mở `be\.env` và đặt `DATABASE_URL` trỏ tới PostgreSQL local. Dùng cùng `POSTGRES_USER`, `POSTGRES_PASSWORD` và `POSTGRES_DB` đã đặt trong `.env` gốc. URL có dạng:

```text
postgresql://<user>:<password>@localhost:5432/kpi_db?schema=public
```

Thay `<user>`, `<password>` và tên database nếu đã đổi `POSTGRES_USER`, `POSTGRES_PASSWORD` hoặc `POSTGRES_DB`. Cổng mặc định là `5432`; nếu cổng đó đã được dịch vụ khác sử dụng, đặt `POSTGRES_PORT=5433` trong `.env` gốc và đổi URL backend thành `localhost:5433`.

Nếu đã tạo database local trước đó, giữ nguyên mật khẩu mà volume PostgreSQL hiện tại đang dùng và đặt cùng mật khẩu trong cả hai file `.env`. Thay biến môi trường trong Compose không tự đổi mật khẩu của database đã được khởi tạo.

Backend yêu cầu `JWT_SECRET` là chuỗi ngẫu nhiên tối thiểu 32 ký tự; giá trị mẫu trong `be\.env.example` không dùng để chạy được. Tạo secret local bằng lệnh sau rồi chép kết quả vào dòng `JWT_SECRET` trong `be\.env`:

```powershell
node -p "require('node:crypto').randomBytes(48).toString('base64url')"
```

Không gửi secret qua chat, không đưa vào `VITE_*` và không commit `be\.env`.

## 3. Khởi động PostgreSQL

Từ thư mục gốc của repository:

```powershell
docker compose up -d postgres
docker compose ps
```

Đảm bảo service `postgres` ở trạng thái đang chạy trước khi tiếp tục.

## 4. Cài dependency và cập nhật database

```powershell
cd be
npm ci
```

Áp dụng schema database và tạo Prisma Client:

```powershell
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
```

`db:migrate:deploy` áp dụng các migration đã có, không tạo migration mới. Lần đầu sẽ tạo schema đánh giá thi đua từ migration PostgreSQL. Nếu cần kiểm tra tình trạng database, chạy:

```powershell
npx prisma migrate status
```

Migration `web_push_subscriptions` bổ sung bảng lưu đăng ký push cho nhiều trình duyệt/thiết bị của một người dùng; migration này không xóa dữ liệu nghiệp vụ.

## 5. Chạy backend và mở Swagger

Trong thư mục `be`, chạy:

```powershell
npm run start:dev
```

- Backend: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

Swagger hiện là tài liệu API; endpoint nghiệp vụ sẽ xuất hiện khi các controller được triển khai. Nhấn `Ctrl+C` trong terminal để dừng backend.

### Thử đăng nhập bằng Swagger

Để kiểm thử Auth, database cần có tài khoản seed. Nếu đã chạy seed, lấy username/password từ file credentials local đã tạo; không đưa nội dung file này vào chat hoặc commit Git.

1. Trong Swagger, mở `POST /api/v1/auth/login`, chọn **Try it out**, nhập credentials:

   ```json
   {
     "username": "admin",
     "password": "mật-khẩu-lấy-từ-file-seed-local"
   }
   ```

2. Chọn **Execute**. Đăng nhập thành công trả `accessToken` cùng thông tin user. Nếu nhận `401 INVALID_CREDENTIALS`, kiểm tra username/password trong file credentials; nếu chưa có tài khoản seed, xem mục **Nạp dữ liệu mẫu (seed)** ở cuối tài liệu.
3. Chọn nút **Authorize** ở đầu trang Swagger, dán riêng giá trị `accessToken` vào ô Bearer token rồi chọn **Authorize** và đóng hộp thoại. Không cần tự thêm chữ `Bearer`.
4. Mở `GET /api/v1/auth/me`, chọn **Try it out** → **Execute**. Nếu token hợp lệ, response trả thông tin user hiện tại; không có token hoặc token sai sẽ trả `401`.

Khi kiểm thử xong, chọn **Logout** trong hộp thoại Authorize để xóa token khỏi Swagger UI. Xóa file credentials local sau khi không còn cần dùng.

# Các lần chạy project sau đó
Sau khi hoàn tất cài đặt ban đầu, mỗi lần mở project để làm việc. Chỉ cần:

1. Mở Docker Desktop.
2. Mở PowerShell ở thư mục gốc `Seminar`. Khởi động PostgreSQL nếu container chưa chạy:

   ```powershell
   docker compose up -d postgres
   ```

   Lệnh này an toàn khi chạy nhiều lần. Nếu PostgreSQL đã chạy thì có thể bỏ qua.
3. Mở một terminal khác (hoặc tiếp tục terminal hiện tại), chuyển vào backend và chạy:

   ```powershell
   cd be
   npm run start:dev
   ```

4. Mở Swagger tại `http://localhost:3000/api/docs`.

Để dừng backend, nhấn `Ctrl+C` trong terminal đang chạy backend. PostgreSQL có thể để chạy nền. Nếu đã dừng PostgreSQL hoặc tắt Docker Desktop, chạy lại lệnh `docker compose up -d postgres` ở bước 2 trong lần làm việc sau.

Không cần chạy lại `npm ci`, `npm run db:generate`, `npm run db:migrate:deploy` hoặc `npm run db:seed` mỗi lần mở project. Chỉ cài dependency lại khi dependency thay đổi; chỉ chạy migration khi có migration mới; seed chỉ chạy khi muốn nạp lại dữ liệu mẫu. Khi pull code mới, xem hướng dẫn phát hành/thay đổi của dự án để biết có cần các bước này không.


## Frontend

Frontend cài đặt và chạy độc lập với backend. Làm theo [Hướng dẫn cài đặt và chạy FE](./FE_GETTING_STARTED.md) để tạo `fe\.env`, cài dependencies và mở Vite dev server.

## Dừng PostgreSQL

Từ thư mục gốc của repository:

```powershell
docker compose down
```

Lệnh trên giữ nguyên volume dữ liệu PostgreSQL. Không dùng `docker compose down -v` trừ khi chủ động muốn xóa dữ liệu local.

-------------------

## Các bước tùy chọn — hiện tại không cần thực hiện

Các bước dưới đây **không bắt buộc để cài dependencies, áp dụng migration hoặc khởi động backend**. Thực hiện khi nhóm bắt đầu cần dữ liệu mẫu, giao diện quản trị database hoặc kiểm thử Web Push.

### Nạp dữ liệu mẫu (seed)

Seed hữu ích để có tài khoản ADMIN, 34 đơn vị demo, kỳ thi đua, hồ sơ nháp và ngưỡng xếp loại để kiểm thử. Không cần seed nếu hiện tại chỉ muốn xác nhận backend khởi động được. Tên đơn vị và tiêu chí trong dữ liệu demo không phải dữ liệu chính thức; cập nhật trước khi dùng thật.

Từ terminal đang ở thư mục `be`, đặt mật khẩu ADMIN tạm thời, chạy seed rồi xóa biến khỏi phiên:

```powershell
$env:SEED_ADMIN_PASSWORD = Read-Host "Nhập mật khẩu tạm thời cho tài khoản seed admin"
$env:SEED_CREDENTIALS_FILE = ".seed-credentials.json"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
Remove-Item Env:SEED_CREDENTIALS_FILE
```

Seed tạo user ADMIN `admin` / `admin@seminar.local` (có thể đổi qua `SEED_ADMIN_USERNAME` và `SEED_ADMIN_EMAIL`) cùng user UNIT `coso01` đến `coso34` với mật khẩu riêng ngẫu nhiên. File `.seed-credentials.json` chứa thông tin đăng nhập ban đầu; lưu trữ an toàn rồi xóa sau khi sử dụng. Tài khoản yêu cầu đổi mật khẩu ở lần đăng nhập đầu. Chạy seed lại không đổi mật khẩu đã tạo.

Nếu seed sắp tạo tài khoản mới hoặc xoay mật khẩu, `SEED_CREDENTIALS_FILE` là bắt buộc; nếu thiếu, seed dừng trước khi thay đổi dữ liệu tài khoản. Mật khẩu không được in ra terminal/log.

Nếu mất mật khẩu seed, có thể đặt `$env:SEED_ROTATE_PASSWORDS = "true"` trước khi seed để xoay mật khẩu; thao tác này làm mật khẩu cũ mất hiệu lực.

### Kiểm thử backend

Auth hiện có `POST /api/v1/auth/login` và `GET /api/v1/auth/me`. Sau khi cấu hình `JWT_SECRET`, áp migration và có tài khoản seed, chạy test auth từ thư mục `be`:

```powershell
npm test
```

Test kiểm tra đăng nhập thành công, thông tin đăng nhập sai, tài khoản bị khóa, token refresh chỉ được lưu dạng hash, xác thực Bearer token và kiểm tra role. Các endpoint refresh/logout/change-password vẫn là phần tiếp theo theo [API contract](./API_CONTRACT.md).

`npm run db:reset` sẽ xóa schema và dữ liệu hiện có trước khi chạy lại migrations/seed. **Không dùng trong quy trình chạy thông thường**; chỉ chạy khi chủ động chấp nhận xóa toàn bộ dữ liệu database local.

### Xem database bằng Prisma Studio

Khi cần xem/chỉnh sửa bản ghi trực tiếp, giữ PostgreSQL đang chạy, mở terminal tại `be` và chạy:

```powershell
npx prisma studio
```

Mở địa chỉ Studio in ra (mặc định `http://localhost:5555`); nhấn `Ctrl+C` để dừng. Swagger chỉ tài liệu hóa API, không phải giao diện xem bảng.

### Cấu hình Web Push (VAPID) -Chỉ thực hiện khi nhóm bắt đầu tích hợp và kiểm thử Web Push.

 Từ thư mục `be`, tạo cặp khóa:

```powershell
npx web-push generate-vapid-keys
```

Lưu `Public Key` vào `WEB_PUSH_VAPID_PUBLIC_KEY`, `Private Key` **chỉ** vào `WEB_PUSH_VAPID_PRIVATE_KEY`, và `WEB_PUSH_SUBJECT` (ví dụ `mailto:admin@example.com`) trong `be\.env`. Cấu hình cùng public key ở `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` trong `fe\.env` theo [hướng dẫn FE](./FE_GETTING_STARTED.md). Không ghi private key vào FE, Git, ảnh chụp màn hình hoặc log; không tạo lại key mỗi lần chạy. Khi đổi key, cập nhật cả hai file `.env` và đăng ký lại subscription trình duyệt.

Không cần chia sẻ file `.env` qua Git. Mỗi môi trường local có thể tự tạo cặp key; public/private của backend và public key frontend trên cùng môi trường phải khớp nhau.
