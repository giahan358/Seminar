import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { test } from "node:test";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../src/prisma/prisma.service.js";
import { UsersService } from "../../src/modules/users/users.service.js";
import { configureHttp } from "../../src/common/configure-http.js";

/** Chạy AppModule, Prisma và PostgreSQL thật trên DB riêng đã migrate, không reset hoặc gửi provider ra ngoài */
test("VC02 HTTP và PostgreSQL thật", async (t) => {
  const databaseUrl = process.env.VC02_TEST_DATABASE_URL;
  assert.ok(databaseUrl, "Cần cấu hình VC02_TEST_DATABASE_URL trỏ DB test riêng đã migrate.");
  const target = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && /^\/vc02_test(?:_|$)/.test(target.pathname), "Chỉ chạy trên DB local có tên bắt đầu vc02_test.");
  Object.assign(process.env, { DATABASE_URL: databaseUrl, NODE_ENV: "test", JWT_SECRET: "vc02-test-secret-at-least-32-characters", CORS_ORIGINS: "http://localhost:5173", BCRYPT_COST: "4", EMAIL_ENABLED: "false", WEB_PUSH_ENABLED: "false", ZALO_ZNS_ENABLED: "false", CREDENTIAL_DELIVERY_ENABLED: "false", STORAGE_PROVIDER: "none" });
  const { AppModule } = await import("../../src/app.module.js");
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  configureHttp(app); await app.listen(0, "127.0.0.1");
  const base = await app.getUrl(); const db = app.get(PrismaService); const jwt = app.get(JwtService);
  const id = randomUUID(); const unitId = randomUUID(); const username = `vc02-${id}`; const now = new Date();
  /** Gửi HTTP và đọc JSON theo giao ước thật, helper chỉ giữ dữ liệu trong bộ nhớ để không ghi token vào artifact */
  async function request(path: string, body?: unknown, token?: string) {
    const response = await fetch(`${base}/api/v1${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), "x-forwarded-for": "203.0.113.42" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  /** Đăng nhập bằng credential fixture để test từng phiên độc lập, không bỏ qua controller hoặc guard */
  async function login(password = "MatKhauMoi98") {
    const result = await request("/auth/login", { username, password }); assert.equal(result.status, 200); return result.body;
  }
  try {
    await db.unit.create({ data: { id: unitId, code: username, name: "Đơn vị kiểm thử VC02", createdAt: now, updatedAt: now } });
    await db.user.create({ data: { id, username, passwordHash: await bcrypt.hash("123456", 4), fullName: "Tài khoản VC02", role: "UNIT", unitId, createdAt: now, updatedAt: now } });
    let initial: Awaited<ReturnType<typeof login>>;
    let changed: Awaited<ReturnType<typeof login>>;
    /** Login demo phải đi vào màn đổi mật khẩu, access chỉ đọc me, nghiệp vụ và refresh đều bị chặn */
    await t.test("Mật khẩu demo bị chặn nghiệp vụ ở BE", async () => {
      initial = await login("123456");
      assert.equal(initial.user.mustChangePassword, true);
      assert.equal(Buffer.from(initial.refreshToken, "base64url").length, 48);
      const row = await db.refreshToken.findUniqueOrThrow({ where: { tokenHash: createHash("sha256").update(initial.refreshToken).digest("hex") } });
      assert.ok(Math.abs(row.expiresAt.getTime() - row.createdAt.getTime() - 604800000) < 1000);
      assert.equal((await request("/auth/me", undefined, initial.accessToken)).body.unit.id, unitId);
      const blocked = await request("/units", undefined, initial.accessToken); assert.equal(blocked.status, 403); assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");
      assert.equal((await request("/auth/refresh", { refreshToken: initial.refreshToken })).body.code, "PASSWORD_CHANGE_REQUIRED");
    });
    /** Policy chạy qua DTO/service thật, hash cũ và phiên cũ không được sống lại sau đổi thành công */
    await t.test("Đổi mật khẩu trả cặp mới và vô hiệu access cũ", async () => {
      const wrong = await request("/auth/change-password", { currentPassword: "sai", newPassword: "MatKhauMoi98" }, initial.accessToken);
      assert.equal(wrong.status, 400); assert.equal(wrong.body.details[0].field, "currentPassword");
      for (const next of ["password123", "á".repeat(36) + "7", "abcdefghijk", "1234567890"]) assert.equal((await request("/auth/change-password", { currentPassword: "123456", newPassword: next }, initial.accessToken)).status, 400);
      const result = await request("/auth/change-password", { currentPassword: "123456", newPassword: "MatKhauMoi98" }, initial.accessToken);
      assert.equal(result.status, 200); changed = result.body;
      assert.equal(changed.user.mustChangePassword, false);
      assert.equal((await request("/auth/me", undefined, initial.accessToken)).status, 401);
      assert.equal((await request("/units", undefined, changed.accessToken)).status, 200);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id } })).credentialVersion, 1);
    });
    /** Chữ ký thật kiểm thuật toán, issuer, audience, tokenUse, UUID, exp và version thay vì mock JwtService */
    await t.test("JWT từ chối claim và chữ ký không đúng giao ước", async () => {
      const valid = { sub: id, tokenUse: "access", ver: 1 };
      const cases = [
        await jwt.signAsync(valid, { algorithm: "HS384" }), await jwt.signAsync(valid, { issuer: "sai" }),
        await jwt.signAsync(valid, { audience: "sai" }), await jwt.signAsync({ ...valid, sub: "sai-uuid" }),
        await jwt.signAsync({ ...valid, tokenUse: "refresh" }), await jwt.signAsync({ sub: id, tokenUse: "access" }),
        await jwt.signAsync({ ...valid, ver: 0 }, { expiresIn: 900 }), await jwt.signAsync(valid, { expiresIn: -1 }),
        await jwt.signAsync(valid),
      ];
      for (const token of cases) assert.equal((await request("/auth/me", undefined, token)).status, 401);
    });
    /** Hai refresh cùng token phải có đúng một winner, loser commit thu hồi cả token winner và phiên khác */
    await t.test("Refresh cạnh tranh và reuse commit thu hồi toàn bộ refresh", async () => {
      const a = await login(); const b = await login();
      const before = (await db.user.findUniqueOrThrow({ where: { id } })).lastLoginAt;
      const results = await Promise.all([request("/auth/refresh", { refreshToken: a.refreshToken }), request("/auth/refresh", { refreshToken: a.refreshToken })]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 401]);
      assert.equal(await db.refreshToken.count({ where: { userId: id, revokedAt: null } }), 0);
      assert.deepEqual((await db.user.findUniqueOrThrow({ where: { id } })).lastLoginAt, before);
      assert.equal((await request("/auth/refresh", { refreshToken: b.refreshToken })).status, 401);
    });
    /** Logout chỉ thu hồi token gửi lên, gọi lặp vẫn 200 và phiên khác tiếp tục xoay được */
    await t.test("Logout idempotent, refresh hết hạn và tài khoản khóa", async () => {
      const a = await login(); const b = await login();
      for (let i = 0; i < 2; i++) assert.equal((await request("/auth/logout", { refreshToken: a.refreshToken })).status, 200);
      const rotated = await request("/auth/refresh", { refreshToken: b.refreshToken }); assert.equal(rotated.status, 200);
      await db.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { expiresAt: new Date(0) } });
      assert.equal((await request("/auth/refresh", { refreshToken: rotated.body.refreshToken })).status, 401);
      await db.unit.update({ where: { id: unitId }, data: { isActive: false } });
      assert.equal((await request("/auth/login", { username, password: "MatKhauMoi98" })).body.code, "INVALID_CREDENTIALS");
      assert.equal((await request("/auth/me", undefined, changed.accessToken)).status, 401);
      await db.unit.update({ where: { id: unitId }, data: { isActive: true } });
      await db.user.update({ where: { id }, data: { isActive: false } });
      assert.equal((await request("/auth/login", { username, password: "MatKhauMoi98" })).body.code, "INVALID_CREDENTIALS");
      await db.user.update({ where: { id }, data: { isActive: true } });
    });
    /** Reset dùng service thật và tăng version, audit chỉ chứa IP từ socket thay vì tin header giả mạo */
    await t.test("Reset vô hiệu access và audit không chứa credential", async () => {
      const pair = await login(); await app.get(UsersService).resetPassword(id);
      assert.equal((await request("/auth/me", undefined, pair.accessToken)).status, 401);
      const rows = await db.auditLog.findMany({ where: { entityId: id } });
      for (const action of ["LOGIN_SUCCESS", "LOGIN_FAILED", "PASSWORD_CHANGED"]) assert.ok(rows.some(r => r.action === action));
      assert.ok(rows.every(r => r.ip === "127.0.0.1"));
      assert.doesNotMatch(JSON.stringify(rows), /123456|MatKhauMoi98|passwordHash|tokenHash|203.0.113.42/);
    });
  } finally {
    // Fixture có audit append-only nên giữ lại trong DB riêng để đối chiếu, không xóa hoặc tắt trigger của hệ thống
    await app.close();
  }
});
