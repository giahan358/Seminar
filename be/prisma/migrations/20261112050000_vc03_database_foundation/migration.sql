-- Áp dụng nguyên tử để lỗi kiểm tra không để lại một phần schema trên DB đích
BEGIN;

-- Bổ sung bảng rỗng nên không backfill dữ liệu nghiệp vụ, giữ user và credential_version từ VC02
-- Cột thời gian UTC không timezone, khóa ngoại NoAction ngăn mất lịch sử khi xóa chủ sở hữu
-- Không đặt TTL tự xóa vì worker cần kiểm hết hạn và hủy payload an toàn theo version
ALTER TABLE "criterion_scores" ADD COLUMN     "supplemented_at" TIMESTAMP(6);

ALTER TABLE "notification_deliveries" ADD COLUMN     "claim_token" UUID,
ADD COLUMN     "claimed_at" TIMESTAMP(6),
ADD COLUMN     "lease_until" TIMESTAMP(6),
ADD COLUMN     "reason_code" VARCHAR;

CREATE TABLE "import_sessions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "rows" JSON NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL DEFAULT 'PREVIEW',
    "result" JSON,
    "created_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "confirmed_at" TIMESTAMP(6),

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "onboarding_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" VARCHAR NOT NULL DEFAULT 'PUSH_REGISTRATION',
    "credential_version" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used_at" TIMESTAMP(6),

    CONSTRAINT "onboarding_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credential_dispatches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_version" INTEGER NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "nonce" BYTEA NOT NULL,
    "tag" BYTEA NOT NULL,
    "key_id" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "canceled_at" TIMESTAMP(6),

    CONSTRAINT "credential_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credential_deliveries" (
    "id" UUID NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "channel" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(6),
    "reason_code" VARCHAR,
    "error_code" VARCHAR,
    "message" VARCHAR,
    "provider_message_id" VARCHAR,
    "sent_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "claimed_at" TIMESTAMP(6),
    "lease_until" TIMESTAMP(6),
    "claim_token" UUID,

    CONSTRAINT "credential_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zalo_connections" (
    "id" UUID NOT NULL,
    "oa_id" VARCHAR NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "nonce" BYTEA NOT NULL,
    "tag" BYTEA NOT NULL,
    "key_id" VARCHAR NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "claimed_at" TIMESTAMP(6),
    "lease_until" TIMESTAMP(6),
    "claim_token" UUID,

    CONSTRAINT "zalo_connections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_sessions_status_expires_at_idx" ON "import_sessions"("status", "expires_at");

CREATE UNIQUE INDEX "import_sessions_admin_id_idempotency_key_key" ON "import_sessions"("admin_id", "idempotency_key");

CREATE UNIQUE INDEX "onboarding_tokens_token_hash_key" ON "onboarding_tokens"("token_hash");

CREATE INDEX "onboarding_tokens_user_id_credential_version_idx" ON "onboarding_tokens"("user_id", "credential_version");

CREATE INDEX "onboarding_tokens_expires_at_idx" ON "onboarding_tokens"("expires_at");

CREATE INDEX "credential_dispatches_expires_at_idx" ON "credential_dispatches"("expires_at");

CREATE UNIQUE INDEX "credential_dispatches_user_id_credential_version_key" ON "credential_dispatches"("user_id", "credential_version");

CREATE INDEX "credential_deliveries_status_next_attempt_at_idx" ON "credential_deliveries"("status", "next_attempt_at");

CREATE INDEX "credential_deliveries_lease_until_idx" ON "credential_deliveries"("lease_until");

CREATE UNIQUE INDEX "credential_deliveries_dispatch_id_channel_key" ON "credential_deliveries"("dispatch_id", "channel");

CREATE UNIQUE INDEX "zalo_connections_oa_id_key" ON "zalo_connections"("oa_id");

ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "onboarding_tokens" ADD CONSTRAINT "onboarding_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "credential_dispatches" ADD CONSTRAINT "credential_dispatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "credential_deliveries" ADD CONSTRAINT "credential_deliveries_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "credential_dispatches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
-- Chỉ chấp nhận trạng thái đã chốt, xác nhận import cần kết quả để retry trả cùng đầu ra
ALTER TABLE import_sessions ADD CONSTRAINT import_sessions_rules CHECK (
 status IN ('PREVIEW','CONFIRMED','EXPIRED') AND expires_at > created_at
 AND digest ~ '^[0-9a-f]{64}$' AND length(idempotency_key) > 0
 AND json_typeof(rows) = 'array'
 AND ((status = 'CONFIRMED' AND confirmed_at IS NOT NULL AND result IS NOT NULL)
 OR (status <> 'CONFIRMED' AND confirmed_at IS NULL AND result IS NULL)));
ALTER TABLE onboarding_tokens ADD CONSTRAINT onboarding_tokens_rules CHECK (
 purpose = 'PUSH_REGISTRATION' AND credential_version >= 0
 AND token_hash ~ '^[0-9a-f]{64}$' AND expires_at > created_at
 AND (used_at IS NULL OR (used_at >= created_at AND used_at < expires_at)));
-- AES-GCM dùng nonce 12 byte và tag 16 byte, DB chỉ kiểm hình dạng chứ không giải mã payload
ALTER TABLE credential_dispatches ADD CONSTRAINT credential_dispatches_rules CHECK (
 credential_version >= 0 AND expires_at > created_at AND octet_length(ciphertext) > 0
 AND octet_length(nonce) = 12 AND octet_length(tag) = 16 AND length(key_id) > 0);
ALTER TABLE zalo_connections ADD CONSTRAINT zalo_connections_rules CHECK (
 token_version >= 0 AND expires_at > created_at AND octet_length(ciphertext) > 0
 AND octet_length(nonce) = 12 AND octet_length(tag) = 16 AND length(key_id) > 0 AND length(oa_id) > 0);
ALTER TABLE credential_deliveries ADD CONSTRAINT credential_deliveries_rules CHECK (
 channel IN ('WEB_PUSH','EMAIL','ZALO_ZNS') AND status IN ('PENDING','SENT','FAILED','SKIPPED')
 AND attempt_count >= 0);
-- Lease trọn bộ ngăn worker nhận việc với claim thiếu, giữ null cho mọi delivery cũ khi nâng cấp
ALTER TABLE credential_deliveries ADD CONSTRAINT credential_deliveries_lease_check CHECK (
 (claimed_at IS NULL AND lease_until IS NULL AND claim_token IS NULL)
 OR (claimed_at IS NOT NULL AND lease_until IS NOT NULL AND claim_token IS NOT NULL AND lease_until > claimed_at));
ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_lease_check CHECK (
 (claimed_at IS NULL AND lease_until IS NULL AND claim_token IS NULL)
 OR (claimed_at IS NOT NULL AND lease_until IS NOT NULL AND claim_token IS NOT NULL AND lease_until > claimed_at));
ALTER TABLE zalo_connections ADD CONSTRAINT zalo_connections_lease_check CHECK (
 (claimed_at IS NULL AND lease_until IS NULL AND claim_token IS NULL)
 OR (claimed_at IS NOT NULL AND lease_until IS NOT NULL AND claim_token IS NOT NULL AND lease_until > claimed_at));

-- Hàm check_criteria_parent_period nhận NEW/OLD của trigger, trả dòng hợp lệ hoặc lỗi có rule identifier
-- Giữ quy tắc cùng kỳ, tiêu chí lá và điểm tối đa, dùng thời điểm câu lệnh UTC để job trễ không mở lại hạn
CREATE OR REPLACE FUNCTION "check_criteria_parent_period"() RETURNS trigger AS $$
DECLARE
  parent_period_id uuid;
BEGIN
  IF NEW."parent_id" IS NOT NULL THEN
    SELECT "period_id" INTO parent_period_id
    FROM "criteria"
    WHERE "id" = NEW."parent_id";

    IF parent_period_id IS DISTINCT FROM NEW."period_id" THEN
      RAISE EXCEPTION 'Tiêu chí cha phải thuộc cùng kỳ đánh giá' USING ERRCODE = '23514', CONSTRAINT = 'CRITERION_PARENT_PERIOD';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hàm check_criterion_score_rules nhận NEW/OLD của trigger, trả dòng hợp lệ hoặc lỗi có rule identifier
-- Giữ quy tắc cùng kỳ, tiêu chí lá và điểm tối đa, dùng thời điểm câu lệnh UTC để job trễ không mở lại hạn
CREATE OR REPLACE FUNCTION "check_criterion_score_rules"() RETURNS trigger AS $$
DECLARE
  ev_period_id uuid;
  ev_status varchar;
  ev_supplement_deadline timestamp;
  cr_period_id uuid;
  cr_max_score decimal;
  self_changed boolean;
BEGIN
  SELECT "period_id", "status", "supplement_deadline"
    INTO ev_period_id, ev_status, ev_supplement_deadline
  FROM "evaluations" WHERE "id" = NEW."evaluation_id";

  SELECT "period_id", "max_score" INTO cr_period_id, cr_max_score
  FROM "criteria" WHERE "id" = NEW."criterion_id";

  IF ev_period_id IS DISTINCT FROM cr_period_id THEN
    RAISE EXCEPTION 'Điểm và hồ sơ phải thuộc cùng kỳ đánh giá' USING ERRCODE = '23514', CONSTRAINT = 'SCORE_PERIOD';
  END IF;

  IF EXISTS (SELECT 1 FROM "criteria" WHERE "parent_id" = NEW."criterion_id") THEN
    RAISE EXCEPTION 'Chỉ được chấm điểm tiêu chí lá' USING ERRCODE = '23514', CONSTRAINT = 'SCORE_LEAF';
  END IF;

  IF NEW."self_score" > cr_max_score OR NEW."admin_score" > cr_max_score THEN
    RAISE EXCEPTION 'Điểm không được vượt quá điểm tối đa của tiêu chí' USING ERRCODE = '23514', CONSTRAINT = 'SCORE_MAX';
  END IF;

  IF TG_OP = 'INSERT' THEN
    self_changed := NEW."self_score" IS NOT NULL OR NEW."self_note" IS NOT NULL;
  ELSE
    self_changed := NEW."self_score" IS DISTINCT FROM OLD."self_score"
                 OR NEW."self_note" IS DISTINCT FROM OLD."self_note";
  END IF;

  IF self_changed AND (
    (ev_status = 'DRAFT' AND EXISTS (SELECT 1 FROM evaluation_periods p WHERE p.id = ev_period_id
      AND p.published_at <= (statement_timestamp() AT TIME ZONE 'UTC') AND p.self_eval_start <= (statement_timestamp() AT TIME ZONE 'UTC')
      AND (statement_timestamp() AT TIME ZONE 'UTC') < p.self_eval_deadline))
    OR (ev_status = 'SUPPLEMENT_REQUESTED' AND NEW."needs_supplement" AND (statement_timestamp() AT TIME ZONE 'UTC') < ev_supplement_deadline)
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'Đã khóa tự chấm đối với tiêu chí này' USING ERRCODE = '23514', CONSTRAINT = 'SELF_EVALUATION_LOCKED';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW."self_score" IS DISTINCT FROM OLD."self_score"
     AND NEW."admin_score" IS NOT DISTINCT FROM OLD."admin_score" THEN
    NEW."admin_score" := NULL;
    NEW."reviewed_by_id" := NULL;
    NEW."reviewed_at" := NULL;
  END IF;

  -- Chỉ thay đổi nội dung tự chấm trong vòng bổ sung mới ghi dấu, việc gắn cờ không đủ bằng chứng
  IF self_changed AND ev_status = 'SUPPLEMENT_REQUESTED' THEN
    NEW.supplemented_at := statement_timestamp() AT TIME ZONE 'UTC';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hàm check_evidence_edit_rules nhận NEW/OLD của trigger, trả dòng hợp lệ hoặc lỗi có rule identifier
-- Giữ quy tắc cùng kỳ, tiêu chí lá và điểm tối đa, dùng thời điểm câu lệnh UTC để job trễ không mở lại hạn
CREATE OR REPLACE FUNCTION "check_evidence_edit_rules"() RETURNS trigger AS $$
DECLARE
  rec "evidences"%ROWTYPE;
  ev_status varchar;
  ev_period_id uuid;
  ev_deadline timestamp;
  is_flagged boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW."criterion_score_id" IS DISTINCT FROM OLD."criterion_score_id" THEN
    RAISE EXCEPTION 'Không được chuyển minh chứng sang điểm tiêu chí khác' USING ERRCODE = '23514', CONSTRAINT = 'EVIDENCE_SCORE_IMMUTABLE';
  END IF;

  SELECT e."status", e."supplement_deadline", cs."needs_supplement", e.period_id
    INTO ev_status, ev_deadline, is_flagged, ev_period_id
  FROM "criterion_scores" cs
  JOIN "evaluations" e ON e."id" = cs."evaluation_id"
  WHERE cs."id" = rec."criterion_score_id";

  IF ev_status = 'DRAFT' AND EXISTS (SELECT 1 FROM evaluation_periods p WHERE p.id = ev_period_id
      AND p.published_at <= (statement_timestamp() AT TIME ZONE 'UTC') AND p.self_eval_start <= (statement_timestamp() AT TIME ZONE 'UTC')
      AND (statement_timestamp() AT TIME ZONE 'UTC') < p.self_eval_deadline) THEN
    IF TG_OP <> 'DELETE' AND NEW."round" <> 'INITIAL' THEN
      RAISE EXCEPTION 'Minh chứng trước khi nộp phải thuộc vòng ban đầu' USING ERRCODE = '23514', CONSTRAINT = 'EVIDENCE_INITIAL_ROUND';
    END IF;
  ELSIF ev_status = 'SUPPLEMENT_REQUESTED' AND is_flagged AND (statement_timestamp() AT TIME ZONE 'UTC') < ev_deadline THEN
    IF TG_OP = 'UPDATE' AND OLD."round" <> 'SUPPLEMENT' THEN
      RAISE EXCEPTION 'Không được sửa minh chứng ban đầu trong vòng bổ sung' USING ERRCODE = '23514', CONSTRAINT = 'EVIDENCE_INITIAL_IMMUTABLE';
    END IF;

    IF TG_OP = 'DELETE' AND OLD."round" <> 'SUPPLEMENT' THEN
      RAISE EXCEPTION 'Không được xóa minh chứng ban đầu trong vòng bổ sung' USING ERRCODE = '23514', CONSTRAINT = 'EVIDENCE_INITIAL_DELETE';
    END IF;

    IF TG_OP <> 'DELETE' AND NEW."round" <> 'SUPPLEMENT' THEN
      RAISE EXCEPTION 'Minh chứng trong vòng bổ sung phải có loại bổ sung' USING ERRCODE = '23514', CONSTRAINT = 'EVIDENCE_SUPPLEMENT_ROUND';
    END IF;
  ELSE
    RAISE EXCEPTION 'Đã khóa minh chứng đối với tiêu chí này' USING ERRCODE = '23514', CONSTRAINT = 'EVIDENCE_LOCKED';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lịch sử chỉ thêm, không phản chiếu tên bảng hay SQL trong câu lỗi, giữ nguyên trigger hiện hữu
CREATE OR REPLACE FUNCTION forbid_row_change() RETURNS trigger AS $$
BEGIN
 RAISE EXCEPTION 'Không được sửa hoặc xóa lịch sử đã ghi nhận'
 USING ERRCODE = '23514', CONSTRAINT = 'HISTORY_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;

-- Chỉ sau khi thao tác minh chứng thành công mới ghi nhận bổ sung, preview worker không kích hoạt trigger này
-- Không ghi khi chỉ gửi lại cùng nội dung, xóa minh chứng bổ sung vẫn là thay đổi thực tế cần thẩm định lại
CREATE FUNCTION record_evidence_supplement() RETURNS trigger AS $$
DECLARE score_id uuid;
BEGIN
 IF TG_OP = 'UPDATE' AND ROW(NEW.kind, NEW.round, NEW.file_name, NEW.mime_type, NEW.size_bytes,
 NEW.storage_path, NEW.external_url, NEW.description) IS NOT DISTINCT FROM
 ROW(OLD.kind, OLD.round, OLD.file_name, OLD.mime_type, OLD.size_bytes,
 OLD.storage_path, OLD.external_url, OLD.description) THEN RETURN NEW; END IF;
 IF TG_OP = 'DELETE' THEN score_id := OLD.criterion_score_id; ELSE score_id := NEW.criterion_score_id; END IF;
 UPDATE criterion_scores cs SET supplemented_at = statement_timestamp() AT TIME ZONE 'UTC'
 FROM evaluations e WHERE cs.id = score_id AND e.id = cs.evaluation_id AND e.status = 'SUPPLEMENT_REQUESTED';
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER evidences_record_supplement AFTER INSERT OR DELETE OR UPDATE OF
 kind, round, file_name, mime_type, size_bytes, storage_path, external_url, description ON evidences
 FOR EACH ROW EXECUTE FUNCTION record_evidence_supplement();

COMMIT;
