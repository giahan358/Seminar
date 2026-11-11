import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Controller, Get, Inject, Module, Param } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../src/prisma/prisma.service.js";
import { AccessService } from "../../src/common/services/access.service.js";
import { AuditService } from "../../src/common/services/audit.service.js";
import { configureHttp } from "../../src/common/configure-http.js";

const fixture = { unitCode: "", firstPeriodId: "", secondPeriodId: "", parentId: "", evaluationId: "" };
const timestamp = new Date("2026-11-25T07:00:00+07:00");

/** Probe chỉ đăng ký trong test để lỗi Prisma/trigger thật đi qua filter HTTP, không thêm đường chẩn đoán vào backend sản phẩm */
@Controller("vc01-db-probe")
class DatabaseProbeController {
  /** Inject các provider thật từ AppModule, không thay DB hoặc helper quyền bằng mock */
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService) {}

  /** Tạo lỗi có chủ đích trên DB test để kiểm unique, FK, CHECK, trigger và P2025 ở biên API */
  @Get(":kind")
  async failure(@Param("kind") kind: string) {
    const unitData = { id: randomUUID(), code: `VC01-${randomUUID()}`, name: "Đơn vị kiểm thử", createdAt: timestamp, updatedAt: timestamp };
    switch (kind) {
      case "unique": return this.prisma.unit.create({ data: { ...unitData, code: fixture.unitCode } });
      case "missing": return this.prisma.unit.update({ where: { id: randomUUID() }, data: { name: "Không tồn tại" } });
      case "foreign": return this.prisma.user.create({ data: { id: randomUUID(), username: `vc01-${randomUUID()}`,
        passwordHash: "hash-chi-dung-test", fullName: "Người dùng kiểm thử", role: "UNIT", unitId: randomUUID(), createdAt: timestamp, updatedAt: timestamp } });
      case "check": return this.prisma.unit.create({ data: { ...unitData, unitType: "INVALID_TYPE" } });
      case "trigger": return this.prisma.criterion.create({ data: { id: randomUUID(), periodId: fixture.secondPeriodId, parentId: fixture.parentId,
        code: `TEST-${randomUUID()}`, name: "Tiêu chí sai kỳ", maxScore: 10, sortOrder: 1, createdAt: timestamp, updatedAt: timestamp } });
      case "raw-check": return this.prisma.$executeRaw`UPDATE units SET unit_type = 'INVALID_TYPE' WHERE code = ${fixture.unitCode}`;
      case "no-unit": await this.access.assertEvaluationAccess(fixture.evaluationId, "UNIT", null); return { success: true };
      case "bad-role": await this.access.assertEvaluationAccess(fixture.evaluationId, "OTHER", null); return { success: true };
      default: return { success: false };
    }
  }
}

/** Bắt buộc URL DB test riêng được truyền tường minh, chặn DB dùng chung và không reset/migrate/seed bằng test này */
test("VC01 chạy AppModule với PostgreSQL thật", async (context) => {
  const databaseUrl = process.env.VC01_TEST_DATABASE_URL;
  assert.ok(databaseUrl, "Cần cấu hình VC01_TEST_DATABASE_URL trỏ tới DB test riêng đã migrate.");
  const target = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && /^\/vc01_test(?:_|$)/.test(target.pathname),
    "Chỉ chạy tích hợp VC01 trên DB local có tên bắt đầu bằng vc01_test.");
  Object.assign(process.env, { DATABASE_URL: databaseUrl, NODE_ENV: "test", JWT_SECRET: "vc01-test-secret-at-least-32-characters",
    CORS_ORIGINS: "http://localhost:5173", EMAIL_ENABLED: "false", WEB_PUSH_ENABLED: "false", ZALO_ZNS_ENABLED: "false", STORAGE_PROVIDER: "none", CREDENTIAL_DELIVERY_ENABLED: "false" });
  const { AppModule } = await import("../../src/app.module.js");
  @Module({ imports: [AppModule], controllers: [DatabaseProbeController] })
  class IntegrationModule {}
  const app = await NestFactory.create(IntegrationModule, { bodyParser: false, logger: false });
  configureHttp(app);
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const prisma = app.get(PrismaService);
  try {
    // Fixture mới mang UUID riêng cho mỗi lượt chạy, không sửa/xóa tài khoản hoặc dữ liệu đang có trên DB
    const unit = await prisma.unit.create({ data: { id: randomUUID(), code: `VC01-${randomUUID()}`, name: "Đơn vị kiểm thử VC01",
      unitType: "DON_VI_TRUC_THUOC", createdAt: timestamp, updatedAt: timestamp } });
    fixture.unitCode = unit.code;
    const username = `vc01-${randomUUID()}`;
    const user = await prisma.user.create({ data: { id: randomUUID(), username, passwordHash: await bcrypt.hash("MatKhauTest123!", 4),
      fullName: "Quản trị viên kiểm thử VC01", role: "ADMIN", mustChangePassword: false, createdAt: timestamp, updatedAt: timestamp } });
    const lastPeriod = await prisma.evaluationPeriod.findFirst({ orderBy: { year: "desc" } });
    const firstPeriod = await prisma.evaluationPeriod.create({ data: { id: randomUUID(), year: (lastPeriod?.year ?? 2039) + 1,
      name: "Kỳ kiểm thử VC01", maxTotalScore: "300.125", selfEvalStart: timestamp,
      selfEvalDeadline: new Date("2026-11-26T00:00:00Z"), createdById: user.id, createdAt: timestamp, updatedAt: timestamp } });
    const secondPeriod = await prisma.evaluationPeriod.create({ data: { id: randomUUID(), year: firstPeriod.year + 1,
      name: "Kỳ khác để kiểm trigger", createdById: user.id, createdAt: timestamp, updatedAt: timestamp } });
    fixture.firstPeriodId = firstPeriod.id;
    fixture.secondPeriodId = secondPeriod.id;
    const parent = await prisma.criterion.create({ data: { id: randomUUID(), periodId: firstPeriod.id, code: "PARENT", name: "Tiêu chí cha",
      maxScore: 10, sortOrder: 1, createdAt: timestamp, updatedAt: timestamp } });
    fixture.parentId = parent.id;
    const evaluation = await prisma.evaluation.create({ data: { id: randomUUID(), periodId: firstPeriod.id, unitId: unit.id,
      createdAt: timestamp, updatedAt: timestamp } });
    fixture.evaluationId = evaluation.id;

    /** Kiểm đủ giao ước và loại tên bảng/SQL/câu trigger cũ ra khỏi response, không đưa token/password vào output test */
    async function checkFailure(path: string, status: number, code: string) {
      const response = await fetch(`${base}/vc01-db-probe/${path}`);
      const body = await response.json();
      assert.equal(response.status, status, `Sai HTTP cho ${path}: ${JSON.stringify(body)}`);
      assert.equal(body.code, code);
      assert.deepEqual(Object.keys(body).sort(), ["code", "details", "message", "statusCode"]);
      assert.deepEqual(body.details, []);
      const messages: Record<string, string> = {
        UNIT_CODE_TAKEN: "Mã đơn vị đã được sử dụng.", NOT_FOUND: "Không tìm thấy tài nguyên được yêu cầu.",
        REFERENCE_IN_USE: "Không thể thực hiện vì dữ liệu đang được tham chiếu.", DB_RULE_VIOLATION: "Dữ liệu không đáp ứng quy tắc của hệ thống.",
      };
      assert.equal(body.message, messages[code]);
      assert.doesNotMatch(JSON.stringify(body), /Prisma|SELECT|units_|criteria_|23514|parent criterion|FOREIGN KEY/);
    }

    // Lỗi phát ra từ Prisma adapter PG thật, gồm cả truy vấn raw và trigger có câu tiếng Anh trong migration cũ
    await context.test("Prisma unique/FK/CHECK/trigger/P2025 qua HTTP thật", async () => {
      for (const [path, status, code] of [["unique", 409, "UNIT_CODE_TAKEN"], ["missing", 404, "NOT_FOUND"],
        ["foreign", 409, "REFERENCE_IN_USE"], ["check", 422, "DB_RULE_VIOLATION"], ["trigger", 422, "DB_RULE_VIOLATION"],
        ["raw-check", 422, "DB_RULE_VIOLATION"], ["no-unit", 404, "NOT_FOUND"], ["bad-role", 404, "NOT_FOUND"]] as const) {
        await checkFailure(path, status, code);
      }
    });

    // Login, guard, controller, service và DB đều thật để chứng minh sửa DI/DTO không chỉ đúng ở unit test tự new controller
    await context.test("Auth và route nghiệp vụ hiện có chạy được trên tsx", async () => {
      const login = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password: "MatKhauTest123!" }) });
      assert.equal(login.status, 200);
      const session = await login.json();
      const headers = { authorization: `Bearer ${session.accessToken}` };
      // Token sai/hết hạn phải dừng tại guard thật và qua filter đủ bốn trường, không lộ lỗi verify của thư viện JWT
      const expired = await app.get(JwtService).signAsync({ sub: user.id, tokenUse: "access" }, { expiresIn: -1 });
      for (const token of ["khong-phai-jwt", expired]) {
        const unauthorized = await fetch(`${base}/api/v1/users`, { headers: { authorization: `Bearer ${token}` } });
        assert.equal(unauthorized.status, 401);
        assert.deepEqual(await unauthorized.json(), { statusCode: 401, code: "UNAUTHORIZED",
          message: "Bạn cần đăng nhập để thực hiện thao tác này.", details: [] });
      }
      for (const path of ["health", "evaluation-periods", `criteria?periodId=${firstPeriod.id}`, "audit-logs"]) {
        const response = await fetch(`${base}/api/v1/${path}`, { headers });
        assert.equal(response.status, 200, `Route ${path} chưa chạy được`);
      }
      const response = await fetch(`${base}/api/v1/evaluation-periods/${firstPeriod.id}`, { headers });
      const period = await response.json();
      assert.equal(period.maxTotalScore, 300.13);
      assert.equal(period.selfEvalStart, "2026-11-25T00:00:00.000Z");
      const invalid = await fetch(`${base}/api/v1/evaluation-periods/${firstPeriod.id}/thresholds`, {
        method: "PUT", headers: { ...headers, "content-type": "application/json" }, body: '[{"rating":"GOOD","label":"Tốt","minPercent":101}]',
      });
      assert.equal(invalid.status, 400);
      assert.ok((await invalid.json()).details.some((detail: { field: string }) => detail.field === "0.minPercent"));
      const unknownField = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password: "MatKhauTest123!", extra: true }) });
      assert.equal(unknownField.status, 400);
    });

    // Kiểm giờ session DB và timestamp không timezone qua adapter, đồng thời kiểm audit thật đã che metadata bí mật
    await context.test("UTC round-trip và audit an toàn trên PostgreSQL", async () => {
      const timezone = await prisma.$queryRaw<{ timezone: string }[]>`SELECT current_setting('TimeZone') AS timezone`;
      assert.equal(timezone[0].timezone, "UTC");
      assert.equal((await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } })).createdAt.toISOString(), timestamp.toISOString());
      await app.get(AuditService).record({ actorId: user.id, action: "VC01_TEST", entity: "Unit", entityId: unit.id,
        after: { name: "Đơn vị kiểm thử", nested: [{ currentPassword: "SECRET_AUDIT", refreshToken: "SECRET_TOKEN", apiKey: "SECRET_KEY" }] } });
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: unit.id, action: "VC01_TEST" } });
      assert.doesNotMatch(JSON.stringify(audit.after), /SECRET_/);
      assert.match(JSON.stringify(audit.after), /ĐÃ CHE/);
    });
  } finally { await app.close(); }
});
