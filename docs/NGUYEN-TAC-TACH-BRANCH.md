# NGUYÊN TẮC

## 1. Quy tắc đặt tên branch và commit

### Tên branch
- Thêm chức năng: `feature/<tên-chức-năng>` (`feature/fe-<tên-chức-năng>/`, `feature/be-<tên-chức-năng>`)
  - Ví dụ: `feature/fe-users`, `feature/be-auth`
- Sửa lỗi: `bugfix/<tên-lỗi>`
  - Ví dụ: `bugfix/fix-login-error`

### Tên commit (Conventional Commits)

- `feat:` cho chức năng hoặc giao diện mới
  - Ví dụ: `feat(user): add login form validation`
- `fix:` cho sửa lỗi
  - Ví dụ: `fix(cart): resolve total amount calculation bug`
- `chore:` cho cấu hình, tài liệu hoặc database
  - Ví dụ: `chore(docs): update API docs`

## 2. Quy trình 5 bước push code theo chức năng

Mỗi khi muốn push một chức năng mới lên Git, hãy thực hiện đúng 5 bước sau:

```bash
# Bước 1: Lấy code mới nhất từ main về máy local
git checkout main
git pull origin main

# Bước 2: Tạo branch mới cho chức năng muốn push
git checkout -b feature/<tên-chức-năng>

# Bước 3: Chỉ add các file hoặc thư mục thuộc chức năng đó
# Thêm tất cả thay đổi trong thư mục backend
git add be/
hoặc git add fe/
# Hoặc thêm cụ thể từng file
git add <đường-dẫn-file-hoặc-folder-chức-năng>

VD: git add be/src/modules/auth/auth.service.ts
# Bước 4: Kiểm tra lại, đảm bảo không add nhầm node_modules hoặc file khác
git status

# Bước 5: Commit và push branch lên GitHub
git commit -m "feat(<tên-mô-đun>): mô tả ngắn gọn chức năng"

VD: git commit -m "feat(be): implement user login with JWT"
# Push nhánh mới này lên serve
git push -u origin feature/<tên-chức-năng>
(Cờ -u chỉ cần dùng cho lần push đầu tiên của nhánh này, các lần sau đang đứng ở nhánh đó chỉ cần gõ git push).
```
