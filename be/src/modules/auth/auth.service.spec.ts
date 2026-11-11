import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service.js";

/** Tạo fixture có hash bcrypt thật và transaction ghi nhận thao tác, chỉ dùng unit test, DB/race được kiểm riêng bằng PostgreSQL */
async function fixture() {
  const user = { id: "11111111-1111-4111-8111-111111111111", username: "admin", fullName: "Quản trị", role: "ADMIN", unitId: null as string | null,
    unit: null as { isActive: boolean } | null, isActive: true, mustChangePassword: false, credentialVersion: 0, passwordHash: await bcrypt.hash("MatKhauCu97", 4) };
  const tokens: Record<string, unknown>[] = [];
  const audits: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let found: typeof user | null = user;
  const prisma = {
    $queryRaw: async () => [],
    user: { findUnique: async () => found, update: async ({ data }: { data: Record<string, unknown> }) => {
      updates.push(data);
      const { credentialVersion, ...rest } = data;
      Object.assign(user, rest);
      if (credentialVersion) user.credentialVersion++;
      return user;
    } },
    refreshToken: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => tokens.find(t => t.tokenHash === where.tokenHash) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => { tokens.push({ revokedAt: null, ...data }); },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = tokens.filter(t => (!where.id || t.id === where.id) && (!where.userId || t.userId === where.userId) && (!where.tokenHash || t.tokenHash === where.tokenHash) && t.revokedAt === null);
        rows.forEach(t => Object.assign(t, data)); return { count: rows.length };
      },
    },
    $transaction: async (callback: (tx: unknown) => unknown) => callback(prisma),
  };
  const jwt = { signAsync: async (payload: unknown, options: unknown) => JSON.stringify({ payload, options }) };
  const service = new AuthService(prisma as never, jwt as never, new ConfigService({ BCRYPT_COST: 4 }), { record: async (data: Record<string, unknown>) => { audits.push(data); } } as never);
  return { service, user, tokens, audits, updates, missing: () => { found = null; } };
}
/** Đọc cấu trúc lỗi chuẩn mà không phụ thuộc chuỗi message NestJS hoặc DB */
const code = (expected: string) => (error: unknown) => (error as { getResponse(): { code: string } }).getResponse().code === expected;

/** Kiểm projection, TTL và hash giúp phát hiện vô tình lưu refresh thô hoặc ký thiếu version/algorithm */
test("Login lưu hash, trả projection và token đúng cấu hình", async () => {
  const f = await fixture(); const pair = await f.service.login({ username: " admin ", password: "MatKhauCu97" }, "127.0.0.1");
  assert.equal(pair.expiresIn, 900); assert.equal(Buffer.from(pair.refreshToken, "base64url").length, 48);
  assert.equal(f.tokens[0]?.tokenHash, createHash("sha256").update(pair.refreshToken).digest("hex"));
  assert.equal("passwordHash" in pair.user, false); assert.equal("credentialVersion" in pair.user, false);
  const signed = JSON.parse(pair.accessToken); assert.equal(signed.options.algorithm, "HS256"); assert.equal(signed.payload.ver, 0);
  assert.equal(signed.options.issuer, "seminar-api"); assert.equal(signed.options.audience, "seminar-web");
  assert.ok(Math.abs((f.tokens[0]?.expiresAt as Date).getTime() - Date.now() - 604800000) < 2000);
  assert.equal(f.audits[0]?.action, "LOGIN_SUCCESS"); assert.equal(f.audits[0]?.ip, "127.0.0.1"); assert.equal(f.updates.length, 1);
});
/** Các trạng thái nhạy cảm phải có cùng lỗi và không tạo token để không tiết lộ user tồn tại hoặc bị khóa */
for (const scenario of ["sai mật khẩu", "không tồn tại", "user khóa", "đơn vị khóa"]) {
  test(`Login từ chối ${scenario}`, async () => {
    const f = await fixture();
    if (scenario === "không tồn tại") f.missing();
    if (scenario === "user khóa") f.user.isActive = false;
    if (scenario === "đơn vị khóa") Object.assign(f.user, { role: "UNIT", unitId: "unit", unit: { isActive: false } });
    await assert.rejects(f.service.login({ username: "admin", password: scenario === "sai mật khẩu" ? "sai" : "MatKhauCu97" }), code("INVALID_CREDENTIALS"));
    assert.equal(f.tokens.length, 0); assert.equal(f.audits[0]?.action, "LOGIN_FAILED");
  });
}
/** Chặn dữ liệu thiếu hoặc quá dài trước truy vấn, kể cả caller nội bộ bỏ qua DTO HTTP */
test("Login chặn field thiếu và vượt giới hạn", async () => {
  const f = await fixture();
  for (const body of [null, {}, { username: "ab", password: "x" }, { username: "a".repeat(65), password: "x" }, { username: "admin", password: "a".repeat(129) }]) await assert.rejects(f.service.login(body), code("VALIDATION_ERROR"));
});
/** Xoay token giữ lastLoginAt, reuse phải hoàn tất thu hồi mọi refresh trước khi trả lỗi ra caller */
test("Refresh xoay và reuse thu hồi toàn bộ phiên đã cấp", async () => {
  const f = await fixture(); const first = await f.service.login({ username: "admin", password: "MatKhauCu97" });
  const second = await f.service.refresh({ refreshToken: first.refreshToken });
  assert.notEqual(second.refreshToken, first.refreshToken); assert.equal(f.updates.length, 1);
  await assert.rejects(f.service.refresh({ refreshToken: first.refreshToken }), code("INVALID_REFRESH_TOKEN"));
  assert.ok(f.tokens.every(t => t.revokedAt));
});
/** Token hết hạn/lạ và tài khoản còn cờ không được xoay phiên, logout lặp lại vẫn thành công */
test("Refresh kiểm hạn, owner và cờ; logout idempotent chỉ thu hồi một token", async () => {
  const f = await fixture(); const a = await f.service.login({ username: "admin", password: "MatKhauCu97" });
  const b = await f.service.login({ username: "admin", password: "MatKhauCu97" });
  f.user.mustChangePassword = true;
  await assert.rejects(f.service.refresh({ refreshToken: a.refreshToken }), code("PASSWORD_CHANGE_REQUIRED"));
  f.user.mustChangePassword = false; f.tokens[0]!.expiresAt = new Date(0);
  await assert.rejects(f.service.refresh({ refreshToken: a.refreshToken }), code("INVALID_REFRESH_TOKEN"));
  await assert.rejects(f.service.refresh({ refreshToken: "lạ" }), code("INVALID_REFRESH_TOKEN"));
  await assert.rejects(f.service.refresh({ refreshToken: "" }), code("VALIDATION_ERROR"));
  await f.service.logout({ refreshToken: a.refreshToken }); await f.service.logout({ refreshToken: a.refreshToken });
  assert.equal(f.tokens[1]?.revokedAt, null); await f.service.logout({ refreshToken: b.refreshToken });
});
/** Kiểm policy có chữ/số, byte UTF-8, danh sách phổ biến, username và so bcrypt để tránh cắt 72 byte */
test("Đổi mật khẩu chặn credential yếu và mật khẩu hiện tại sai", async () => {
  const f = await fixture();
  for (const next of ["short", "abcdefghijk", "12345678901", "password123", "á".repeat(36) + "7", "MatKhauCu97"]) {
    await assert.rejects(f.service.changePassword(f.user, { currentPassword: "MatKhauCu97", newPassword: next }), code("VALIDATION_ERROR"));
  }
  await assert.rejects(f.service.changePassword(f.user, { currentPassword: "sai", newPassword: "MatKhauMoi98" }), (e: unknown) => {
    const error = e as { getStatus(): number; getResponse(): { details: { field: string; messages: string[] }[] } };
    assert.equal(error.getStatus(), 400); assert.equal(error.getResponse().details[0]?.field, "currentPassword");
    assert.equal(error.getResponse().details[0]?.messages[0], "Mật khẩu hiện tại không chính xác."); return true;
  });
  f.user.username = "MatKhauMoi98";
  await assert.rejects(f.service.changePassword(f.user, { currentPassword: "MatKhauCu97", newPassword: "matkhaumoi98" }), code("VALIDATION_ERROR"));
});
/** Đổi thành công phải trả cặp token ver mới, hash mới và cờ đã xóa, mọi refresh trước đó bị thu hồi */
test("Đổi mật khẩu tạo phiên mới và audit nguyên tử", async () => {
  const f = await fixture(); f.user.mustChangePassword = true;
  await f.service.login({ username: "admin", password: "MatKhauCu97" });
  const pair = await f.service.changePassword(f.user, { currentPassword: "MatKhauCu97", newPassword: "MatKhauMoi98" });
  assert.equal(pair.user.mustChangePassword, false); assert.equal(JSON.parse(pair.accessToken).payload.ver, 1);
  assert.ok(f.tokens[0]?.revokedAt); assert.equal(f.tokens[1]?.revokedAt, null);
  assert.ok(await bcrypt.compare("MatKhauMoi98", f.user.passwordHash)); assert.equal(f.audits.at(-1)?.action, "PASSWORD_CHANGED");
  const me = await f.service.getMe(f.user.id); assert.equal(me.unit, null); assert.equal("passwordHash" in me, false);
});

/** Legacy hash có thể được tạo từ chuỗi quá 72 byte, mật khẩu mới là tiền tố phải bị so bcrypt nhận diện tương đương */
test("Không đổi sang chuỗi khác nhưng tương đương bcrypt do cắt byte", async () => {
  const f = await fixture(); const prefix = "a".repeat(70) + "97";
  f.user.passwordHash = await bcrypt.hash(prefix + "đuôi-cũ", 4);
  await assert.rejects(f.service.changePassword(f.user, { currentPassword: prefix + "đuôi-cũ", newPassword: prefix }), code("VALIDATION_ERROR"));
});
