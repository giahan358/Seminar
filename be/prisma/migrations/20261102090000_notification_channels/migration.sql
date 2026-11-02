-- =====================================================================
-- Migration gộp một lần: thông báo đa kênh (Web Push, Email, Telegram; ZALO_ZNS để sau),
-- cột/chỉ mục phục vụ job nền, báo cáo, audit và bảo vệ lịch sử không bị sửa.
-- Chạy một lần bằng: npm run db:migrate:deploy
-- Không sửa các migration đã có. Thông tin liên hệ nằm ở users.email, users.phone (không thêm vào units).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kênh thông báo: thêm TELEGRAM, giữ ZALO_ZNS dành sẵn
-- ---------------------------------------------------------------------
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_channel_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_channel_check"
  CHECK ("channel" IN ('SYSTEM', 'WEB_PUSH', 'EMAIL', 'TELEGRAM', 'ZALO_ZNS'));

-- Khóa chống gửi trùng, dùng cho mọi thông báo do job/sự kiện sinh ra (nhắc hạn, mở chấm, khóa hồ sơ, hết hạn bổ sung...).
-- Ví dụ: 'SELF_EVAL_REMINDER_24H:<evaluationId>'. NULL nghĩa là không cần chống trùng (NULL không bị coi là trùng nhau).
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" varchar;
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications" ("user_id", "dedupe_key");
-- Hộp thư: danh sách thông báo mới nhất của một người
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at");

-- ---------------------------------------------------------------------
-- 2. Tài khoản
-- ---------------------------------------------------------------------
-- credentials_sent_at: thời điểm gửi thông tin đăng nhập thành công (chỉ thời điểm, không lưu nội dung hay mật khẩu)
-- password_changed_at: để từ chối access token cấp trước khi đổi/reset mật khẩu
ALTER TABLE "users"
  ADD COLUMN "credentials_sent_at" timestamp,
  ADD COLUMN "password_changed_at" timestamp;

-- Thu hồi toàn bộ refresh token của một user nhanh
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens" ("user_id", "revoked_at");

-- ---------------------------------------------------------------------
-- 3. Kết quả gửi theo từng kênh (SYSTEM không có delivery vì là chính bản ghi notifications)
--    Lỗi một kênh chỉ ảnh hưởng dòng của kênh đó, không ảnh hưởng nghiệp vụ.
-- ---------------------------------------------------------------------
CREATE TABLE "notification_deliveries" (
  "id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "channel" varchar NOT NULL,
  "status" varchar NOT NULL DEFAULT 'PENDING',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp,
  "last_error" varchar,
  "provider_message_id" varchar,
  "sent_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_channel_check" CHECK ("channel" IN ('WEB_PUSH', 'EMAIL', 'TELEGRAM', 'ZALO_ZNS')),
  CONSTRAINT "notification_deliveries_status_check" CHECK ("status" IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  CONSTRAINT "notification_deliveries_attempt_check" CHECK ("attempt_count" >= 0)
);

CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key"
  ON "notification_deliveries" ("notification_id", "channel");
-- Job retry chọn các dòng PENDING đến hạn thử lại
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx"
  ON "notification_deliveries" ("status", "next_attempt_at");

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications" ("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------
-- 4. Người dùng bật/tắt từng kênh. Không có dòng nghĩa là mặc định bật. SYSTEM luôn bật nên không lưu.
-- ---------------------------------------------------------------------
CREATE TABLE "notification_preferences" (
  "user_id" uuid NOT NULL,
  "channel" varchar NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id", "channel"),
  CONSTRAINT "notification_preferences_channel_check" CHECK ("channel" IN ('WEB_PUSH', 'EMAIL', 'TELEGRAM', 'ZALO_ZNS'))
);

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------
-- 5. Liên kết tài khoản với chat Telegram. Mỗi user một liên kết, mỗi chat một tài khoản.
-- ---------------------------------------------------------------------
CREATE TABLE "telegram_bindings" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "chat_id" varchar NOT NULL,
  "telegram_username" varchar,
  "linked_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  CONSTRAINT "telegram_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_bindings_user_id_key" ON "telegram_bindings" ("user_id");
CREATE UNIQUE INDEX "telegram_bindings_chat_id_key" ON "telegram_bindings" ("chat_id");

ALTER TABLE "telegram_bindings"
  ADD CONSTRAINT "telegram_bindings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------
-- 6. Token liên kết dùng một lần cho deep link t.me/<bot>?start=<token>. Chỉ lưu hash, hết hạn ngắn (VD 15 phút).
-- ---------------------------------------------------------------------
CREATE TABLE "telegram_link_tokens" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" varchar NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "telegram_link_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_link_tokens_token_hash_key" ON "telegram_link_tokens" ("token_hash");
CREATE INDEX "telegram_link_tokens_user_id_idx" ON "telegram_link_tokens" ("user_id");

ALTER TABLE "telegram_link_tokens"
  ADD CONSTRAINT "telegram_link_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------
-- 7. Báo cáo xuất: tên file và dung lượng để hiển thị danh sách và đặt tên khi tải
-- ---------------------------------------------------------------------
ALTER TABLE "report_exports"
  ADD COLUMN "file_name" varchar,
  ADD COLUMN "size_bytes" bigint;
CREATE INDEX "report_exports_period_id_created_at_idx" ON "report_exports" ("period_id", "created_at");

-- ---------------------------------------------------------------------
-- 8. Chỉ mục phục vụ job nền, view dashboard và lọc audit
-- ---------------------------------------------------------------------
-- Job hết hạn bổ sung: tìm hồ sơ SUPPLEMENT_REQUESTED quá hạn
CREATE INDEX "evaluations_status_supplement_deadline_idx" ON "evaluations" ("status", "supplement_deadline");
-- v_criteria_deductions nối theo criterion_id
CREATE INDEX "criterion_scores_criterion_id_idx" ON "criterion_scores" ("criterion_id");
-- Lọc audit theo người thao tác và theo hành động, kèm khoảng thời gian
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs" ("actor_id", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs" ("action", "created_at");

-- ---------------------------------------------------------------------
-- 9. Lịch sử chỉ được thêm, không được sửa/xóa (audit_logs, status_histories)
--    TRUNCATE vẫn dùng được cho reset dữ liệu dev/test; ứng dụng không có đường nào sửa hoặc xóa từng dòng.
-- ---------------------------------------------------------------------
CREATE FUNCTION "forbid_row_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "forbid_row_change"();

CREATE TRIGGER "status_histories_append_only"
  BEFORE UPDATE OR DELETE ON "status_histories"
  FOR EACH ROW EXECUTE FUNCTION "forbid_row_change"();