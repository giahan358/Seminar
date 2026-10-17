-- =====================================================================
-- HỆ THỐNG ĐÁNH GIÁ, XẾP LOẠI THI ĐUA CÔNG TÁC ĐOÀN VÀ PHONG TRÀO THANH NIÊN
-- Ban Thanh niên CATP - 34 Cơ sở Đoàn trực thuộc - Năm 2026
-- PostgreSQL 14+
-- =====================================================================

-- ---------------------------------------------------------------------
-- NHÓM 1: ĐƠN VỊ & TÀI KHOẢN
-- ---------------------------------------------------------------------

-- 34 Cơ sở Đoàn trực thuộc Ban Thanh niên CATP (VD: Đoàn Công an quận/huyện/TP Thủ Đức, Đoàn Phòng nghiệp vụ, Đoàn Trung đoàn...)
CREATE TABLE "units" (
  "id" uuid PRIMARY KEY,
  "code" varchar UNIQUE NOT NULL,
  "name" varchar NOT NULL,
  "unit_type" varchar,
  "sort_order" int NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "units_unit_type_check" CHECK ("unit_type" IS NULL OR "unit_type" IN ('CONG_AN_QUAN_HUYEN', 'PHONG_NGHIEP_VU', 'DON_VI_TRUC_THUOC'))
);

-- ADMIN (Ban Thanh niên CATP) và UNIT (tài khoản con của từng cơ sở)
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY,
  "username" varchar UNIQUE NOT NULL,
  "password_hash" varchar NOT NULL,
  "must_change_password" boolean NOT NULL DEFAULT true,
  "full_name" varchar NOT NULL,
  "email" varchar UNIQUE,
  "phone" varchar,
  "role" varchar NOT NULL,
  "unit_id" uuid,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_login_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "users_role_check" CHECK ("role" IN ('ADMIN', 'UNIT')),
  CONSTRAINT "users_role_unit_check" CHECK (
    ("role" = 'UNIT' AND "unit_id" IS NOT NULL)
    OR ("role" = 'ADMIN' AND "unit_id" IS NULL)
  )
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "token_hash" varchar UNIQUE NOT NULL,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL
);

-- ---------------------------------------------------------------------
-- NHÓM 2: ĐỢT THI ĐUA, THANG ĐIỂM & XẾP LOẠI
-- ---------------------------------------------------------------------

-- Đợt thi đua (năm 2026): thời gian mở/đóng hệ thống, giai đoạn, thời hạn bổ sung
CREATE TABLE "evaluation_periods" (
  "id" uuid PRIMARY KEY,
  "year" int UNIQUE NOT NULL,
  "name" varchar NOT NULL,
  "phase" varchar NOT NULL DEFAULT 'SETUP',
  "max_total_score" decimal NOT NULL DEFAULT 300,
  "self_eval_start" timestamp,
  "self_eval_deadline" timestamp,
  "supplement_hours" int NOT NULL DEFAULT 48,
  "published_at" timestamp,
  "finalized_at" timestamp,
  "created_by_id" uuid NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "evaluation_periods_phase_check" CHECK ("phase" IN ('SETUP', 'SELF_EVAL', 'FIRST_REVIEW', 'SUPPLEMENT', 'FINAL_REVIEW', 'CLOSED')),
  CONSTRAINT "evaluation_periods_max_score_check" CHECK ("max_total_score" > 0),
  CONSTRAINT "evaluation_periods_supplement_hours_check" CHECK ("supplement_hours" > 0),
  CONSTRAINT "evaluation_periods_time_check" CHECK (
    "self_eval_start" IS NULL OR "self_eval_deadline" IS NULL OR "self_eval_start" < "self_eval_deadline"
  )
);

-- Định mức xếp loại theo % tổng điểm (cấu hình theo đợt)
--   EXCELLENT : > 85%            (min_percent = 85, min_exclusive = true)
--   GOOD      : 65% <= x <= 85%   (min_percent = 65)
--   PASS      : 50% <= x < 65%    (min_percent = 50)
--   FAIL      : x < 50%           (min_percent = 0)
-- Mỗi mức lấy cận dưới; fn_rating_for_percent chọn mức cao nhất thỏa điều kiện nên không lọt khe tại 85/65/50.
CREATE TABLE "rating_thresholds" (
  "id" uuid PRIMARY KEY,
  "period_id" uuid NOT NULL,
  "rating" varchar NOT NULL,
  "label" varchar NOT NULL,
  "min_percent" decimal NOT NULL,
  "min_exclusive" boolean NOT NULL DEFAULT false,
  "color" varchar,
  CONSTRAINT "rating_thresholds_rating_check" CHECK ("rating" IN ('EXCELLENT', 'GOOD', 'PASS', 'FAIL')),
  CONSTRAINT "rating_thresholds_percent_check" CHECK ("min_percent" BETWEEN 0 AND 100)
);

-- Thang điểm (~30 tiêu chí / 300 điểm). Có thể phân nhóm cha - con;
-- chỉ tiêu chí lá (không có con) mới được chấm điểm, tổng điểm = tổng điểm các mục lá.
CREATE TABLE "criteria" (
  "id" uuid PRIMARY KEY,
  "period_id" uuid NOT NULL,
  "parent_id" uuid,
  "code" varchar NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "max_score" decimal NOT NULL,
  "evidence_requirement" text,
  "allow_text" boolean NOT NULL DEFAULT true,
  "allow_file" boolean NOT NULL DEFAULT true,
  "allow_link" boolean NOT NULL DEFAULT true,
  "evidence_required" boolean NOT NULL DEFAULT true,
  "sort_order" int NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "criteria_max_score_check" CHECK ("max_score" > 0)
);

-- ---------------------------------------------------------------------
-- NHÓM 3: HỒ SƠ THI ĐUA CỦA TỪNG ĐƠN VỊ & THẨM ĐỊNH
-- ---------------------------------------------------------------------

-- Hồ sơ của 1 đơn vị trong 1 đợt (4 giai đoạn)
--   DRAFT                : Chưa nộp / đang làm dở (Giai đoạn 1)
--   PENDING_REVIEW       : Chờ duyệt - đã nộp hoặc bị Auto-lock hết hạn (Giai đoạn 2)
--   SUPPLEMENT_REQUESTED : Admin yêu cầu bổ sung, đang đếm ngược 48h (Giai đoạn 3)
--   SUPPLEMENT_SUBMITTED : Đơn vị đã bổ sung, chờ Admin thẩm định
--   SUPPLEMENT_EXPIRED   : Hết 48h - khóa vĩnh viễn quyền nộp
--   FINALIZED            : Admin đã khóa sổ/chốt điểm (Giai đoạn 4)
CREATE TABLE "evaluations" (
  "id" uuid PRIMARY KEY,
  "period_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "status" varchar NOT NULL DEFAULT 'DRAFT',
  "submitted_at" timestamp,
  "auto_locked_at" timestamp,
  "first_reviewed_at" timestamp,
  "supplement_requested_at" timestamp,
  "supplement_deadline" timestamp,
  "supplement_submitted_at" timestamp,
  "finalized_at" timestamp,
  "finalized_by_id" uuid,
  "final_score" decimal,
  "final_percent" decimal,
  "final_rating" varchar,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "evaluations_status_check" CHECK ("status" IN ('DRAFT', 'PENDING_REVIEW', 'SUPPLEMENT_REQUESTED', 'SUPPLEMENT_SUBMITTED', 'SUPPLEMENT_EXPIRED', 'FINALIZED')),
  CONSTRAINT "evaluations_final_rating_check" CHECK ("final_rating" IS NULL OR "final_rating" IN ('EXCELLENT', 'GOOD', 'PASS', 'FAIL')),
  CONSTRAINT "evaluations_supplement_deadline_check" CHECK (
    "status" NOT IN ('SUPPLEMENT_REQUESTED', 'SUPPLEMENT_SUBMITTED', 'SUPPLEMENT_EXPIRED')
    OR "supplement_deadline" IS NOT NULL
  ),
  CONSTRAINT "evaluations_finalized_check" CHECK (
    "status" <> 'FINALIZED'
    OR ("finalized_at" IS NOT NULL AND "final_score" IS NOT NULL AND "final_percent" IS NOT NULL AND "final_rating" IS NOT NULL)
  )
);

-- Điểm từng tiêu chí: cơ sở tự chấm + Admin thẩm định (side-by-side)
CREATE TABLE "criterion_scores" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid NOT NULL,
  "criterion_id" uuid NOT NULL,
  "self_score" decimal,
  "self_note" text,
  "admin_score" decimal,
  "admin_comment" text,
  "needs_supplement" boolean NOT NULL DEFAULT false,
  "supplement_note" text,
  "reviewed_by_id" uuid,
  "reviewed_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "criterion_scores_self_score_check" CHECK ("self_score" IS NULL OR "self_score" >= 0),
  CONSTRAINT "criterion_scores_admin_score_check" CHECK ("admin_score" IS NULL OR "admin_score" >= 0),
  CONSTRAINT "criterion_scores_admin_reason_check" CHECK (
    "admin_score" IS NULL OR "self_score" IS NULL OR "admin_score" = "self_score"
    OR length(btrim(COALESCE("admin_comment", ''))) > 0
  )
);

-- Minh chứng đa phương tiện (preview_status/preview_path: bản xem trước; ảnh/PDF xem trực tiếp = NOT_REQUIRED, Word cần worker convert sang PDF): file (ảnh/PDF/Word) hoặc link ngoài. Nội dung diễn giải nằm ở criterion_scores.self_note
CREATE TABLE "evidences" (
  "id" uuid PRIMARY KEY,
  "criterion_score_id" uuid NOT NULL,
  "uploader_id" uuid NOT NULL,
  "kind" varchar NOT NULL,
  "round" varchar NOT NULL DEFAULT 'INITIAL',
  "file_name" varchar,
  "mime_type" varchar,
  "size_bytes" bigint,
  "storage_path" varchar,
  "external_url" varchar,
  "description" text,
  "preview_status" varchar NOT NULL DEFAULT 'NOT_REQUIRED',
  "preview_path" varchar,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "evidences_preview_status_check" CHECK ("preview_status" IN ('NOT_REQUIRED', 'PENDING', 'READY', 'FAILED')),
  CONSTRAINT "evidences_kind_check" CHECK ("kind" IN ('FILE', 'LINK')),
  CONSTRAINT "evidences_round_check" CHECK ("round" IN ('INITIAL', 'SUPPLEMENT')),
  CONSTRAINT "evidences_kind_payload_check" CHECK (
    ("kind" = 'FILE' AND "file_name" IS NOT NULL AND "storage_path" IS NOT NULL)
    OR ("kind" = 'LINK' AND "external_url" IS NOT NULL)
  ),
  CONSTRAINT "evidences_mime_check" CHECK (
    "kind" <> 'FILE' OR "mime_type" IS NULL OR "mime_type" IN (
      'image/jpeg', 'image/png', 'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  )
);

-- Phản hồi / yêu cầu giải trình / yêu cầu bổ sung giữa Admin và từng đơn vị
CREATE TABLE "evaluation_feedbacks" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "type" varchar NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "evaluation_feedbacks_type_check" CHECK ("type" IN ('SUPPLEMENT_REQUEST', 'EXPLANATION_REQUEST', 'GENERAL', 'UNIT_REPLY'))
);

-- ---------------------------------------------------------------------
-- NHÓM 4: NHẬT KÝ, THÔNG BÁO & XUẤT BÁO CÁO
-- ---------------------------------------------------------------------

-- Lịch sử chuyển trạng thái hồ sơ (chỉ INSERT). actor_id NULL = hệ thống tự động (Auto-lock, hết 48h)
CREATE TABLE "status_histories" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid NOT NULL,
  "actor_id" uuid,
  "from_status" varchar,
  "to_status" varchar NOT NULL,
  "comment" text,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "status_histories_from_status_check" CHECK ("from_status" IS NULL OR "from_status" IN ('DRAFT', 'PENDING_REVIEW', 'SUPPLEMENT_REQUESTED', 'SUPPLEMENT_SUBMITTED', 'SUPPLEMENT_EXPIRED', 'FINALIZED')),
  CONSTRAINT "status_histories_to_status_check" CHECK ("to_status" IN ('DRAFT', 'PENDING_REVIEW', 'SUPPLEMENT_REQUESTED', 'SUPPLEMENT_SUBMITTED', 'SUPPLEMENT_EXPIRED', 'FINALIZED'))
);

-- Thông báo / nhắc việc (hệ thống, Web Push, Email, Zalo ZNS); scheduled_at dùng cho nhắc hẹn giờ (VD: còn 24h)
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "channel" varchar NOT NULL DEFAULT 'SYSTEM',
  "type" varchar NOT NULL,
  "title" varchar NOT NULL,
  "body" text NOT NULL,
  "ref_type" varchar,
  "ref_id" uuid,
  "is_read" boolean NOT NULL DEFAULT false,
  "scheduled_at" timestamp,
  "sent_at" timestamp,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "notifications_channel_check" CHECK ("channel" IN ('SYSTEM', 'WEB_PUSH', 'EMAIL', 'ZALO_ZNS'))
);

-- Audit log: ai sửa, sửa từ gì thành gì (before/after), lúc mấy giờ
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY,
  "actor_id" uuid,
  "action" varchar NOT NULL,
  "entity" varchar NOT NULL,
  "entity_id" varchar NOT NULL,
  "before" json,
  "after" json,
  "ip" varchar,
  "created_at" timestamp NOT NULL
);

-- Lịch sử xuất báo cáo (Bảng tổng hợp 34 cơ sở / Biên bản thẩm định từng đơn vị)
CREATE TABLE "report_exports" (
  "id" uuid PRIMARY KEY,
  "period_id" uuid NOT NULL,
  "evaluation_id" uuid,
  "report_type" varchar NOT NULL,
  "format" varchar NOT NULL,
  "storage_path" varchar NOT NULL,
  "created_by_id" uuid NOT NULL,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "report_exports_type_check" CHECK ("report_type" IN ('SUMMARY_ALL_UNITS', 'UNIT_APPRAISAL_MINUTES')),
  CONSTRAINT "report_exports_format_check" CHECK ("format" IN ('XLSX', 'PDF', 'DOCX')),
  CONSTRAINT "report_exports_scope_check" CHECK (
    ("report_type" = 'SUMMARY_ALL_UNITS' AND "evaluation_id" IS NULL)
    OR ("report_type" = 'UNIT_APPRAISAL_MINUTES' AND "evaluation_id" IS NOT NULL)
  )
);

-- ---------------------------------------------------------------------
-- TRIGGERS TOÀN VẸN DỮ LIỆU
-- ---------------------------------------------------------------------

CREATE FUNCTION "check_criteria_parent_period"() RETURNS trigger AS $$
DECLARE
  parent_period_id uuid;
BEGIN
  IF NEW."parent_id" IS NOT NULL THEN
    SELECT "period_id" INTO parent_period_id
    FROM "criteria"
    WHERE "id" = NEW."parent_id";

    IF parent_period_id IS DISTINCT FROM NEW."period_id" THEN
      RAISE EXCEPTION 'A parent criterion must belong to the same evaluation period'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "criteria_parent_period_check"
  BEFORE INSERT OR UPDATE OF "period_id", "parent_id" ON "criteria"
  FOR EACH ROW EXECUTE FUNCTION "check_criteria_parent_period"();

-- Điểm tiêu chí: cùng đợt, chỉ chấm tiêu chí lá, không vượt điểm tối đa,
-- và cơ sở chỉ được sửa phần tự chấm khi hồ sơ chưa bị khóa (hoặc đang trong 48h bổ sung đúng mục được yêu cầu)
CREATE FUNCTION "check_criterion_score_rules"() RETURNS trigger AS $$
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
    RAISE EXCEPTION 'A score and its evaluation must belong to the same period'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM "criteria" WHERE "parent_id" = NEW."criterion_id") THEN
    RAISE EXCEPTION 'Only leaf criteria can be scored'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."self_score" > cr_max_score OR NEW."admin_score" > cr_max_score THEN
    RAISE EXCEPTION 'Score must not exceed the criterion maximum score'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    self_changed := NEW."self_score" IS NOT NULL OR NEW."self_note" IS NOT NULL;
  ELSE
    self_changed := NEW."self_score" IS DISTINCT FROM OLD."self_score"
                 OR NEW."self_note" IS DISTINCT FROM OLD."self_note";
  END IF;

  IF self_changed AND NOT (
    ev_status = 'DRAFT'
    OR (ev_status = 'SUPPLEMENT_REQUESTED' AND NEW."needs_supplement" AND now() <= ev_supplement_deadline)
  ) THEN
    RAISE EXCEPTION 'Self-evaluation is locked for this criterion'
      USING ERRCODE = '23514';
  END IF;

  -- Đơn vị sửa điểm tự chấm (giai đoạn bổ sung) => điểm Admin cũ không còn hiệu lực, Admin phải chấm lại
  IF TG_OP = 'UPDATE'
     AND NEW."self_score" IS DISTINCT FROM OLD."self_score"
     AND NEW."admin_score" IS NOT DISTINCT FROM OLD."admin_score" THEN
    NEW."admin_score" := NULL;
    NEW."reviewed_by_id" := NULL;
    NEW."reviewed_at" := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "criterion_scores_rules_check"
  BEFORE INSERT OR UPDATE OF "evaluation_id", "criterion_id", "self_score", "self_note", "admin_score" ON "criterion_scores"
  FOR EACH ROW EXECUTE FUNCTION "check_criterion_score_rules"();

-- Minh chứng: chỉ được thêm/sửa/xóa khi hồ sơ DRAFT (round INITIAL),
-- hoặc SUPPLEMENT_REQUESTED + đúng mục needs_supplement + còn trong hạn (round SUPPLEMENT)
CREATE FUNCTION "check_evidence_edit_rules"() RETURNS trigger AS $$
DECLARE
  rec "evidences"%ROWTYPE;
  ev_status varchar;
  ev_deadline timestamp;
  is_flagged boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW."criterion_score_id" IS DISTINCT FROM OLD."criterion_score_id" THEN
    RAISE EXCEPTION 'An evidence cannot be moved to another criterion score'
      USING ERRCODE = '23514';
  END IF;

  SELECT e."status", e."supplement_deadline", cs."needs_supplement"
    INTO ev_status, ev_deadline, is_flagged
  FROM "criterion_scores" cs
  JOIN "evaluations" e ON e."id" = cs."evaluation_id"
  WHERE cs."id" = rec."criterion_score_id";

  IF ev_status = 'DRAFT' THEN
    IF TG_OP <> 'DELETE' AND NEW."round" <> 'INITIAL' THEN
      RAISE EXCEPTION 'Evidence added before submission must have round INITIAL'
        USING ERRCODE = '23514';
    END IF;
  ELSIF ev_status = 'SUPPLEMENT_REQUESTED' AND is_flagged AND now() <= ev_deadline THEN
    IF TG_OP = 'UPDATE' AND OLD."round" <> 'SUPPLEMENT' THEN
      RAISE EXCEPTION 'Initial evidence cannot be modified during the supplement period'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' AND OLD."round" <> 'SUPPLEMENT' THEN
      RAISE EXCEPTION 'Initial evidence cannot be deleted during the supplement period'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP <> 'DELETE' AND NEW."round" <> 'SUPPLEMENT' THEN
      RAISE EXCEPTION 'Evidence must have round SUPPLEMENT during the supplement period'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Evidence is locked for this criterion'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Không bắt các cột preview để worker convert file vẫn cập nhật được sau khi hồ sơ bị khóa
CREATE TRIGGER "evidences_edit_check"
  BEFORE INSERT OR UPDATE OF "criterion_score_id", "kind", "round", "file_name", "mime_type", "size_bytes", "storage_path", "external_url", "description" ON "evidences"
  FOR EACH ROW EXECUTE FUNCTION "check_evidence_edit_rules"();

CREATE TRIGGER "evidences_delete_check"
  BEFORE DELETE ON "evidences"
  FOR EACH ROW EXECUTE FUNCTION "check_evidence_edit_rules"();

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX ON "users" ("unit_id") WHERE "unit_id" IS NOT NULL;   -- mỗi cơ sở đúng 1 tài khoản
CREATE UNIQUE INDEX ON "rating_thresholds" ("period_id", "rating");
CREATE UNIQUE INDEX ON "criteria" ("period_id", "code");
CREATE UNIQUE INDEX ON "evaluations" ("period_id", "unit_id");
CREATE UNIQUE INDEX ON "criterion_scores" ("evaluation_id", "criterion_id");
CREATE INDEX ON "evaluations" ("period_id", "status");
CREATE INDEX ON "evidences" ("criterion_score_id");
CREATE INDEX ON "evaluation_feedbacks" ("evaluation_id", "created_at");
CREATE INDEX ON "status_histories" ("evaluation_id", "created_at");
CREATE INDEX ON "notifications" ("user_id", "is_read");
CREATE INDEX ON "audit_logs" ("entity", "entity_id");
CREATE INDEX ON "audit_logs" ("created_at");

-- ---------------------------------------------------------------------
-- FOREIGN KEYS
-- ---------------------------------------------------------------------

ALTER TABLE "users" ADD FOREIGN KEY ("unit_id") REFERENCES "units" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluation_periods" ADD FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "rating_thresholds" ADD FOREIGN KEY ("period_id") REFERENCES "evaluation_periods" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "criteria" ADD FOREIGN KEY ("period_id") REFERENCES "evaluation_periods" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "criteria" ADD FOREIGN KEY ("parent_id") REFERENCES "criteria" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluations" ADD FOREIGN KEY ("period_id") REFERENCES "evaluation_periods" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evaluations" ADD FOREIGN KEY ("unit_id") REFERENCES "units" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evaluations" ADD FOREIGN KEY ("finalized_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "criterion_scores" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "criterion_scores" ADD FOREIGN KEY ("criterion_id") REFERENCES "criteria" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "criterion_scores" ADD FOREIGN KEY ("reviewed_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evidences" ADD FOREIGN KEY ("criterion_score_id") REFERENCES "criterion_scores" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evidences" ADD FOREIGN KEY ("uploader_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluation_feedbacks" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evaluation_feedbacks" ADD FOREIGN KEY ("author_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "status_histories" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "status_histories" ADD FOREIGN KEY ("actor_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "audit_logs" ADD FOREIGN KEY ("actor_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report_exports" ADD FOREIGN KEY ("period_id") REFERENCES "evaluation_periods" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "report_exports" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "report_exports" ADD FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

-- ---------------------------------------------------------------------
-- HÀM & VIEW PHỤC VỤ TÍNH ĐIỂM REAL-TIME, XẾP LOẠI, DASHBOARD
-- ---------------------------------------------------------------------

-- Gợi ý/xếp loại theo % điểm dựa trên bảng rating_thresholds của đợt
CREATE FUNCTION "fn_rating_for_percent"(p_period_id uuid, p_percent decimal) RETURNS varchar AS $$
  SELECT "rating"
  FROM "rating_thresholds"
  WHERE "period_id" = p_period_id
    AND (p_percent > "min_percent" OR (p_percent = "min_percent" AND NOT "min_exclusive"))
  ORDER BY "min_percent" DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Tổng điểm tự chấm / điểm đang hiệu lực (Admin chấm nếu có, ngược lại lấy điểm tự chấm) / xếp loại tạm thời
CREATE VIEW "v_evaluation_totals" AS
SELECT
  e."id" AS "evaluation_id",
  e."period_id",
  e."unit_id",
  e."status",
  COALESCE(e."submitted_at", e."auto_locked_at") AS "submitted_at",
  p."max_total_score",
  COALESCE(SUM(cs."self_score"), 0) AS "self_total",
  COALESCE(SUM(COALESCE(cs."admin_score", cs."self_score")), 0) AS "current_total",
  COALESCE(SUM(COALESCE(cs."admin_score", cs."self_score")), 0) / p."max_total_score" * 100 AS "current_percent",
  fn_rating_for_percent(
    e."period_id",
    COALESCE(SUM(COALESCE(cs."admin_score", cs."self_score")), 0) / p."max_total_score" * 100
  ) AS "suggested_rating"
FROM "evaluations" e
JOIN "evaluation_periods" p ON p."id" = e."period_id"
LEFT JOIN "criterion_scores" cs ON cs."evaluation_id" = e."id"
GROUP BY e."id", e."period_id", e."unit_id", e."status", e."submitted_at", e."auto_locked_at", p."max_total_score";

-- Bảng xếp hạng thời gian thực
CREATE VIEW "v_leaderboard" AS
SELECT
  t.*,
  u."code" AS "unit_code",
  u."name" AS "unit_name",
  -- score_rank: đồng hạng theo điểm; rank: thứ tự cuối cùng, hòa điểm thì đơn vị nộp sớm hơn đứng trước, rồi theo thứ tự đơn vị
  RANK() OVER (PARTITION BY t."period_id" ORDER BY t."current_total" DESC) AS "score_rank",
  ROW_NUMBER() OVER (
    PARTITION BY t."period_id"
    ORDER BY t."current_total" DESC, t."submitted_at" ASC NULLS LAST, u."sort_order", u."id"
  ) AS "rank"
FROM "v_evaluation_totals" t
JOIN "units" u ON u."id" = t."unit_id";

-- Tiêu chí bị trừ điểm nhiều nhất (điểm yếu chung của các cơ sở)
CREATE VIEW "v_criteria_deductions" AS
SELECT
  c."period_id",
  c."id" AS "criterion_id",
  c."code",
  c."name",
  COUNT(*) FILTER (WHERE cs."admin_score" < cs."self_score") AS "units_deducted",
  COALESCE(SUM(cs."self_score" - cs."admin_score") FILTER (WHERE cs."admin_score" < cs."self_score"), 0) AS "total_points_deducted"
FROM "criteria" c
LEFT JOIN "criterion_scores" cs ON cs."criterion_id" = c."id"
GROUP BY c."period_id", c."id", c."code", c."name";
