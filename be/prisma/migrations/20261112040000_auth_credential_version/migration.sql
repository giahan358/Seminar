-- Bổ sung version mặc định 0 và backfill user hiện có, không xóa dữ liệu hoặc sửa migration đã triển khai
-- Access token phải có claim ver bằng cột này, token cũ thiếu ver buộc đăng nhập lại khi rollout
-- Tăng version cùng transaction đổi hoặc reset mật khẩu để vô hiệu mọi access cũ kể cả cấp trong cùng giây
ALTER TABLE "users" ADD COLUMN "credential_version" integer NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD CONSTRAINT "users_credential_version_check" CHECK ("credential_version" >= 0);
