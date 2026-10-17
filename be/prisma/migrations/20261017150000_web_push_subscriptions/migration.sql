CREATE TABLE "web_push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR NOT NULL,
    "auth" VARCHAR NOT NULL,
    "expiration_time" BIGINT,
    "user_agent" VARCHAR,
    "created_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "revoked_at" TIMESTAMP(6),

    CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "web_push_subscriptions_endpoint_key"
    ON "web_push_subscriptions"("endpoint");
CREATE INDEX "web_push_subscriptions_user_id_revoked_at_idx"
    ON "web_push_subscriptions"("user_id", "revoked_at");

ALTER TABLE "web_push_subscriptions"
    ADD CONSTRAINT "web_push_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
