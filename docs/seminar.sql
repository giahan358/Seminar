CREATE TABLE "departments" (
  "id" uuid PRIMARY KEY,
  "code" varchar UNIQUE NOT NULL,
  "name" varchar NOT NULL,
  "is_active" boolean DEFAULT true,
  "head_user_id" uuid UNIQUE,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY,
  "email" varchar UNIQUE NOT NULL,
  "password_hash" varchar NOT NULL,
  "must_change_password" boolean DEFAULT false,
  "full_name" varchar NOT NULL,
  "birth_date" date,
  "phone" varchar,
  "role" varchar NOT NULL,
  "is_active" boolean DEFAULT true,
  "last_login_at" timestamp,
  "party_position" varchar,
  "government_position" varchar,
  "union_position" varchar,
  "department_id" uuid,
  "signature_url" varchar,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "token_hash" varchar UNIQUE NOT NULL,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL
);

CREATE TABLE "evaluation_periods" (
  "id" uuid PRIMARY KEY,
  "year" int,
  "quarter" int,
  "name" varchar NOT NULL,
  "phase" varchar NOT NULL,
  "kpi_setup_deadline" timestamp,
  "self_eval_start" timestamp,
  "self_eval_deadline" timestamp,
  "unit_review_deadline" timestamp,
  "final_review_deadline" timestamp,
  "scoring_config" json,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "rating_thresholds" (
  "id" uuid PRIMARY KEY,
  "period_id" uuid,
  "rating" varchar,
  "min_score" decimal NOT NULL
);

CREATE TABLE "common_criteria" (
  "id" uuid PRIMARY KEY,
  "period_id" uuid NOT NULL,
  "parent_id" uuid,
  "code" varchar NOT NULL,
  "content" text NOT NULL,
  "max_score" decimal NOT NULL,
  "sort_order" int NOT NULL
);

CREATE TABLE "kpi_axes" (
  "id" uuid PRIMARY KEY,
  "code" varchar UNIQUE NOT NULL,
  "name" varchar NOT NULL,
  "sort_order" int NOT NULL
);

CREATE TABLE "evaluations" (
  "id" uuid PRIMARY KEY,
  "period_id" uuid,
  "user_id" uuid,
  "status" varchar NOT NULL,
  "kpi_published_at" timestamp,
  "submitted_at" timestamp,
  "unit_reviewed_at" timestamp,
  "finalized_at" timestamp,
  "published_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "evaluation_summaries" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid,
  "reviewer_id" uuid,
  "signature_url" varchar,
  "reviewed_at" timestamp,
  "level" varchar,
  "score_a" decimal,
  "score_b" decimal,
  "score_c" decimal,
  "total_score" decimal,
  "rating" varchar,
  "comment" text
);

CREATE TABLE "common_scores" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid,
  "criterion_id" uuid,
  "level" varchar,
  "score" decimal NOT NULL,
  "note" text
);

CREATE TABLE "kpi_assignments" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid NOT NULL,
  "axis_id" uuid NOT NULL,
  "standard_kpi_id" uuid,
  "source" varchar NOT NULL,
  "sort_order" int NOT NULL,
  "name" text NOT NULL,
  "expected_output" text,
  "deadline_text" varchar,
  "deadline_date" date,
  "work_type" varchar,
  "base_score" decimal NOT NULL,
  "difficulty_coef" decimal NOT NULL,
  "max_score" decimal NOT NULL,
  "evidence_requirement" text,
  "created_by_id" uuid NOT NULL,
  "proposal_id" uuid UNIQUE,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "standard_kpis" (
  "id" uuid PRIMARY KEY,
  "period_id" uuid,
  "department_id" uuid,
  "axis_id" uuid NOT NULL,
  "name" text NOT NULL,
  "expected_output" text,
  "base_score" decimal NOT NULL,
  "difficulty_coef" decimal NOT NULL,
  "created_by_id" uuid NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "kpi_scores" (
  "id" uuid PRIMARY KEY,
  "assignment_id" uuid,
  "level" varchar,
  "progress_pct" decimal NOT NULL,
  "result_pct" decimal NOT NULL,
  "achieved_score" decimal NOT NULL,
  "converted_score" decimal NOT NULL,
  "exceed_note" text,
  "note" text,
  "scored_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "kpi_proposals" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid NOT NULL,
  "proposer_id" uuid NOT NULL,
  "axis_id" uuid,
  "status" varchar NOT NULL,
  "round" int DEFAULT 1,
  "name" text NOT NULL,
  "description" text,
  "expected_output" text,
  "deadline_text" varchar,
  "work_type" varchar DEFAULT 'DOT_XUAT',
  "base_score" decimal,
  "difficulty_coef" decimal,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "proposal_reviews" (
  "id" uuid PRIMARY KEY,
  "proposal_id" uuid NOT NULL,
  "reviewer_id" uuid NOT NULL,
  "level" varchar NOT NULL,
  "decision" varchar NOT NULL,
  "round" int NOT NULL,
  "comment" text,
  "created_at" timestamp NOT NULL
);

CREATE TABLE "bonuses" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid NOT NULL,
  "description" text NOT NULL,
  "points" decimal NOT NULL,
  "status" varchar NOT NULL,
  "approved_by_id" uuid,
  "created_at" timestamp NOT NULL
);

CREATE TABLE "evidences" (
  "id" uuid PRIMARY KEY,
  "uploader_id" uuid NOT NULL,
  "assignment_id" uuid,
  "proposal_id" uuid,
  "bonus_id" uuid,
  "file_name" varchar NOT NULL,
  "mime_type" varchar,
  "size_bytes" int,
  "storage_path" varchar NOT NULL,
  "external_url" varchar,
  "description" text,
  "created_at" timestamp NOT NULL
);

CREATE TABLE "status_histories" (
  "id" uuid PRIMARY KEY,
  "evaluation_id" uuid NOT NULL,
  "actor_id" uuid NOT NULL,
  "from_status" varchar,
  "to_status" varchar NOT NULL,
  "comment" text,
  "created_at" timestamp NOT NULL
);

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "type" varchar NOT NULL,
  "title" varchar NOT NULL,
  "body" text NOT NULL,
  "ref_type" varchar,
  "ref_id" uuid,
  "is_read" boolean DEFAULT false,
  "created_at" timestamp NOT NULL
);

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

CREATE UNIQUE INDEX ON "evaluation_periods" ("year", "quarter");

CREATE UNIQUE INDEX ON "rating_thresholds" ("period_id", "rating");

CREATE UNIQUE INDEX ON "evaluations" ("period_id", "user_id");

CREATE UNIQUE INDEX ON "evaluation_summaries" ("evaluation_id", "level");

CREATE UNIQUE INDEX ON "common_scores" ("evaluation_id", "criterion_id", "level");

CREATE UNIQUE INDEX ON "kpi_scores" ("assignment_id", "level");

ALTER TABLE "users" ADD FOREIGN KEY ("id") REFERENCES "departments" ("head_user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "users" ADD FOREIGN KEY ("department_id") REFERENCES "departments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "rating_thresholds" ADD FOREIGN KEY ("period_id") REFERENCES "evaluation_periods" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "common_criteria" ADD FOREIGN KEY ("period_id") REFERENCES "evaluation_periods" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "common_criteria" ADD FOREIGN KEY ("parent_id") REFERENCES "common_criteria" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluations" ADD FOREIGN KEY ("period_id") REFERENCES "evaluation_periods" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluations" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluation_summaries" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluation_summaries" ADD FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "common_scores" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "common_scores" ADD FOREIGN KEY ("criterion_id") REFERENCES "common_criteria" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_assignments" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_assignments" ADD FOREIGN KEY ("axis_id") REFERENCES "kpi_axes" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_assignments" ADD FOREIGN KEY ("standard_kpi_id") REFERENCES "standard_kpis" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_assignments" ADD FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_proposals" ADD FOREIGN KEY ("id") REFERENCES "kpi_assignments" ("proposal_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "standard_kpis" ADD FOREIGN KEY ("period_id") REFERENCES "evaluation_periods" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "standard_kpis" ADD FOREIGN KEY ("department_id") REFERENCES "departments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "standard_kpis" ADD FOREIGN KEY ("axis_id") REFERENCES "kpi_axes" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "standard_kpis" ADD FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_scores" ADD FOREIGN KEY ("assignment_id") REFERENCES "kpi_assignments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_proposals" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_proposals" ADD FOREIGN KEY ("proposer_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kpi_proposals" ADD FOREIGN KEY ("axis_id") REFERENCES "kpi_axes" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "proposal_reviews" ADD FOREIGN KEY ("proposal_id") REFERENCES "kpi_proposals" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "proposal_reviews" ADD FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bonuses" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bonuses" ADD FOREIGN KEY ("approved_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evidences" ADD FOREIGN KEY ("uploader_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evidences" ADD FOREIGN KEY ("assignment_id") REFERENCES "kpi_assignments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evidences" ADD FOREIGN KEY ("proposal_id") REFERENCES "kpi_proposals" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evidences" ADD FOREIGN KEY ("bonus_id") REFERENCES "bonuses" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "status_histories" ADD FOREIGN KEY ("evaluation_id") REFERENCES "evaluations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "status_histories" ADD FOREIGN KEY ("actor_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("actor_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
