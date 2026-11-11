import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger";

/** Tạo Swagger từ toàn bộ AppModule bằng tsx để bắt lỗi thiếu design:type trước bước listen, không cần kết nối hoặc ghi DB */
test("Swagger khởi tạo được bằng tsx và giữ đúng kiểu DTO ngưỡng xếp loại", async () => {
  const fixture = { NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/vc01_test",
    JWT_SECRET: "swagger-test-secret-at-least-32-characters", CORS_ORIGINS: "http://localhost:5173",
    EMAIL_ENABLED: "false", WEB_PUSH_ENABLED: "false", ZALO_ZNS_ENABLED: "false", STORAGE_PROVIDER: "none", CREDENTIAL_DELIVERY_ENABLED: "false" };
  const previous = Object.fromEntries(Object.keys(fixture).map((key) => [key, process.env[key]]));
  Object.assign(process.env, fixture);
  try {
    const { AppModule } = await import("../app.module.js");
    const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false, abortOnError: false });
    try {
      // Không gọi init/listen nên Prisma chưa kết nối, nhưng Swagger vẫn khám phá đúng các controller/DTO thực của ứng dụng
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("Kiểm thử Swagger").setVersion("1").build());
      const schema = document.components?.schemas?.UpsertRatingThresholdDto as SchemaObject;
      assert.ok(schema?.properties);
      assert.equal((schema.properties.rating as SchemaObject).type, "string");
      assert.equal((schema.properties.label as SchemaObject).type, "string");
      assert.equal((schema.properties.minPercent as SchemaObject).type, "number");
      assert.equal((schema.properties.minExclusive as SchemaObject).type, "boolean");
      assert.equal((schema.properties.color as SchemaObject).type, "string");
      assert.equal((schema.properties.color as SchemaObject).nullable, true);
      assert.deepEqual(schema.required, ["rating", "label", "minPercent"]);
      assert.ok(document.paths["/api/v1/evaluation-periods/{id}/thresholds"]?.put?.requestBody);
      // Auth phải khai báo response cặp token mới sau đổi mật khẩu và giới hạn login tường minh cho cả tsx lẫn bản build
      const login = document.components?.schemas?.LoginDto as SchemaObject;
      assert.equal((login.properties?.username as SchemaObject).minLength, 3);
      assert.equal((login.properties?.password as SchemaObject).maxLength, 128);
      const pair = document.components?.schemas?.AuthTokenPairDto as SchemaObject;
      assert.deepEqual(pair.required, ["accessToken", "refreshToken", "tokenType", "expiresIn", "user"]);
      assert.ok(document.paths["/api/v1/auth/change-password"]?.post?.responses?.["200"]);
    } finally { await app.close(); }
  } finally {
    // Khôi phục từng env đã thay để fixture kiểm Swagger không ảnh hưởng test hoặc tiến trình gọi tiếp theo
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
