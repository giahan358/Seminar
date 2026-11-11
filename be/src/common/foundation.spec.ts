import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AccessService } from "./services/access.service.js";
import { ClockService } from "./services/clock.service.js";
import { DeadlineCalculator } from "./services/deadline-calculator.js";
import { serializeApiValue } from "./interceptors/api-serialization.interceptor.js";
import { Prisma } from "../generated/prisma/client.js";
import { validateEnvironment } from "../config/env.validation.js";
import { databaseError } from "./filters/all-exceptions.filter.js";
import { redactSecrets } from "./utils/redact-secrets.util.js";

/** Chứng minh UNIT thiếu/sai đơn vị và role lạ dừng trước DB, không tạo query UUID giả gây 500 hoặc mở quyền quản trị */
test("AccessService từ chối danh tính không hợp lệ trước khi truy vấn", async () => {
  let calls = 0;
  const service = new AccessService({ evaluation: { findFirst: async () => { calls++; return null; } } } as never);
  for (const [role, unitId] of [["UNIT", null], ["UNIT", "sai-ma"], ["OTHER", null]]) {
    await assert.rejects(service.assertEvaluationAccess("11111111-1111-4111-8111-111111111111", role!, unitId),
      (error: unknown) => (error as { getStatus(): number }).getStatus() === 404);
  }
  assert.equal(calls, 0);
});

/** Đảm bảo query ADMIN theo id còn UNIT luôn kèm unitId, kết quả không có dữ liệu trả 404 cùng giao ước */
test("AccessService chỉ truy vấn trong phạm vi được phép", async () => {
  const queries: unknown[] = [];
  const service = new AccessService({ evaluation: { findFirst: async (query: unknown) => { queries.push(query); return { id: "có" }; } } } as never);
  const id = "11111111-1111-4111-8111-111111111111";
  const unitId = "22222222-2222-4222-8222-222222222222";
  await service.assertEvaluationAccess(id, "ADMIN", null);
  await service.assertEvaluationAccess(id, "UNIT", unitId);
  assert.deepEqual(queries, [{ where: { id }, select: { id: true } }, { where: { id, unitId }, select: { id: true } }]);
});

/** Dùng offset Việt Nam để kiểm mốc UTC và biên [start,deadline), đồng hồ trả bản sao và không nhận thời gian mơ hồ */
test("ClockService inject được và giữ đúng biên UTC", () => {
  const clock = new ClockService();
  clock.set("2026-11-25T07:00:00+07:00");
  assert.equal(clock.now().toISOString(), "2026-11-25T00:00:00.000Z");
  clock.now().setFullYear(2000);
  assert.equal(clock.now().getUTCFullYear(), 2026);
  const calculator = new DeadlineCalculator(clock);
  const window = { publishedAt: new Date("2026-11-20T00:00:00Z"), selfEvalStart: clock.now(), selfEvalDeadline: new Date("2026-11-26T00:00:00Z") };
  assert.equal(calculator.canSelfEvaluate(window, "DRAFT"), true);
  clock.set(window.selfEvalDeadline);
  assert.equal(calculator.canSelfEvaluate(window, "DRAFT"), false);
  assert.equal(calculator.isExpired(window.selfEvalDeadline), true);
  assert.throws(() => clock.set("2026-11-25T07:00:00"), /thiếu múi giờ/);
  assert.throws(() => clock.set("sai"), /không hợp lệ/);
  clock.reset();
  assert.ok(Math.abs(clock.now().getTime() - Date.now()) < 1000);
});

/** Kiểm số lớn không mất chính xác, điểm âm làm tròn đúng và chuỗi văn bản/ngày null không bị diễn giải thành số */
test("Serializer bảo toàn Decimal, BigInt và UTC trong cây JSON", () => {
  assert.deepEqual(serializeApiValue({ score: new Prisma.Decimal("12.345"), negative: new Prisma.Decimal("-1.235"),
    rows: [42n, 9007199254740992n, -9007199254740992n, null], text: "001", at: new Date("2026-11-25T07:00:00+07:00") }),
  { score: 12.35, negative: -1.24, rows: [42, "9007199254740992", "-9007199254740992", null], text: "001", at: "2026-11-25T00:00:00.000Z" });
});

const baseConfig = { DATABASE_URL: "postgresql://test:test@localhost:5432/vc01_test", JWT_SECRET: "test-secret-123456789012345678901234", CORS_ORIGINS: "http://localhost:5173" };

/** Khi provider tắt không đòi secret thật, khi bật thiếu cấu hình phải thất bại bằng tên env và không lộ giá trị bí mật */
test("Config theo cờ tính năng và thông báo tiếng Việt không lộ secret", () => {
  const config = validateEnvironment(baseConfig);
  assert.equal(config.INITIAL_ACCOUNT_PASSWORD, "123456");
  assert.equal(config.JWT_REFRESH_TTL, 604800);
  // Demo không cấp tài khoản ZNS, xác nhận cả mặc định và cờ false từ env đều không yêu cầu secret
  assert.equal(config.ZALO_ZNS_ENABLED, false);
  assert.equal(validateEnvironment({ ...baseConfig, ZALO_ZNS_ENABLED: "false" }).ZALO_ZNS_ENABLED, false);
  for (const flag of ["EMAIL_ENABLED", "WEB_PUSH_ENABLED", "ZALO_ZNS_ENABLED", "CREDENTIAL_DELIVERY_ENABLED"]) {
    assert.throws(() => validateEnvironment({ ...baseConfig, [flag]: true }), /Cấu hình môi trường/);
  }
  assert.throws(() => validateEnvironment({ ...baseConfig, JWT_SECRET: "bi-mat-khong-duoc-lo" }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /JWT_SECRET/);
    assert.doesNotMatch(error.message, /bi-mat-khong-duoc-lo|length|is required/);
    return true;
  });
  for (const origin of ["*", "http://localhost:5173,*", "http://user:secret@localhost:5173", "http://localhost:5173/path"]) {
    assert.throws(() => validateEnvironment({ ...baseConfig, CORS_ORIGINS: origin }), /Cấu hình CORS/);
  }
  assert.throws(() => validateEnvironment({ ...baseConfig, NODE_ENV: "production" }), /INITIAL_ACCOUNT_PASSWORD/);
  const encrypted = { ...baseConfig, CREDENTIAL_DELIVERY_ENABLED: true, CREDENTIALS_ENCRYPTION_KEY_ID: "test-v1" };
  assert.throws(() => validateEnvironment({ ...encrypted, CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(31).toString("base64") }), /đúng 32 byte/);
  assert.equal(validateEnvironment({ ...encrypted, CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") }).CREDENTIAL_DELIVERY_ENABLED, true);
  assert.equal(validateEnvironment({ ...baseConfig, EMAIL_ENABLED: true, SMTP_HOST: "smtp.example.test", SMTP_USER: "test",
    SMTP_PASSWORD: "mat-khau-thu", MAIL_FROM: "test@example.test" }).EMAIL_ENABLED, true);
  assert.throws(() => validateEnvironment({ ...baseConfig, ZALO_ZNS_ENABLED: true, ZALO_APP_ID: "test", ZALO_APP_SECRET: "test",
    ZALO_OA_ID: "test", ZALO_ZNS_TEMPLATE_MAP: "{}" }), /ánh xạ sự kiện/);
});

/** Mã SQL chưa nhận diện phải là 500, FK/unique/CHECK giữ ý nghĩa riêng và không đưa meta.message vào phản hồi */
test("Ánh xạ DB dùng mã ổn định và bỏ thông điệp SQL thô", () => {
  const cases: [unknown, number, string][] = [
    [{ code: "P2002", meta: { target: ["username"] } }, 409, "USERNAME_TAKEN"],
    [{ code: "P2025" }, 404, "NOT_FOUND"], [{ code: "P2003" }, 409, "REFERENCE_IN_USE"],
    [{ code: "P2010", meta: { code: "23514", message: "SELECT secret FROM users" } }, 422, "DB_RULE_VIOLATION"],
    [{ code: "P2010", meta: { code: "42601", message: "SELECT secret FROM users" } }, 500, "INTERNAL_ERROR"],
    [{ code: "P1001" }, 503, "DATABASE_UNAVAILABLE"],
  ];
  for (const [error, status, code] of cases) {
    const result = databaseError(error);
    assert.equal(result?.statusCode, status);
    assert.equal(result?.code, code);
    assert.deepEqual(result?.details, []);
    assert.doesNotMatch(JSON.stringify(result), /SELECT|secret|users/);
  }
});

/** Audit lồng nhiều tầng vẫn che password/token/key/ciphertext, giữ trường nghiệp vụ và không thay đổi object đầu vào */
test("Che bí mật trong metadata audit", () => {
  const input = { action: "UPDATE", nested: [{ currentPassword: "S1", newPassword: "S2", refreshToken: "S3", authorization: "S4", apiKey: "S5", ciphertext: "S6", cookie: "S7" }] };
  const safe = JSON.stringify(redactSecrets(input));
  assert.doesNotMatch(safe, /S[1-7]/);
  assert.match(safe, /UPDATE/);
  assert.equal(input.nested[0].newPassword, "S2");
});
