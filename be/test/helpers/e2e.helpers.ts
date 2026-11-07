import { randomUUID } from "node:crypto";

/** Vai trò hợp lệ của người dùng trong bộ kiểm thử */
export type TestRole = "ADMIN" | "UNIT";

/** Kiểu Prisma tối thiểu mà các hàm tạo dữ liệu cần dùng */
export type TestDatabase = {
  unit: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
  user: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
  evaluationPeriod: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
  criterion: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
  $executeRawUnsafe(query: string): Promise<number>;
};

/** Cấu hình địa chỉ máy chủ và thông tin đăng nhập của bộ E2E */
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const testPassword = process.env.E2E_PASSWORD ?? "Test-password-123!";

/** Tạo một đơn vị mẫu có thể ghi đè các trường dữ liệu */
export async function createUnit(
  prisma: TestDatabase,
  override: Record<string, unknown> = {},
) {
  const now = new Date();
  return prisma.unit.create({
    data: {
      id: randomUUID(),
      code: `TEST-${randomUUID().slice(0, 8)}`,
      name: "Đơn vị kiểm thử",
      unitType: "DON_VI_TRUC_THUOC",
      sortOrder: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...override,
    },
  });
}

/** Tạo tài khoản mẫu với mật khẩu đã băm và vai trò tùy chọn */
export async function createTestUser(
  prisma: TestDatabase,
  override: Record<string, unknown> & { role?: TestRole } = {},
) {
  const { role = "ADMIN", ...fields } = override;
  const now = new Date();
  const username = `test-${randomUUID()}`;
  const passwordHash = await import("bcryptjs").then(({ default: bcrypt }) =>
    bcrypt.hash(testPassword, 4),
  );
  return prisma.user.create({
    data: {
      id: randomUUID(),
      username,
      passwordHash,
      mustChangePassword: false,
      fullName: "Người dùng kiểm thử",
      email: `${username}@example.test`,
      role,
      unitId: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...fields,
    },
  });
}

/** Tạo kỳ đánh giá và một tiêu chí mẫu, trả về cả hai bản ghi */
export async function createPeriodWithCriteria(
  prisma: TestDatabase,
  createdById: string,
  override: Record<string, unknown> = {},
) {
  const now = new Date();
  const period = await prisma.evaluationPeriod.create({
    data: {
      id: randomUUID(),
      year: 2000 + Math.floor(Math.random() * 8000),
      name: `TEST-${String(override.name ?? "Kỳ đánh giá kiểm thử")}-${randomUUID()}`,
      phase: "SETUP",
      maxTotalScore: 300,
      supplementHours: 48,
      createdById,
      createdAt: now,
      updatedAt: now,
      ...override,
    },
  });
  const criterion = await prisma.criterion.create({
    data: {
      id: randomUUID(),
      periodId: period.id,
      parentId: null,
      code: "TEST-1",
      name: "Tiêu chí kiểm thử",
      maxScore: 10,
      allowText: true,
      allowFile: true,
      allowLink: true,
      evidenceRequired: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
  });
  return { period, criterion };
}

/** Đăng nhập bằng tài khoản E2E đã được cấu hình và trả về Bearer header */
export async function login(role: TestRole = "ADMIN") {
  const username = role === "ADMIN"
    ? process.env.E2E_ADMIN_USERNAME
    : process.env.E2E_UNIT_USERNAME;
  if (!username) {
    throw new Error(`Thiếu biến môi trường đăng nhập cho vai trò ${role}`);
  }
  const response = await api().post("/api/v1/auth/login", {
    username,
    password: testPassword,
  });
  if (!response.ok) {
    throw new Error(`Đăng nhập E2E thất bại với mã HTTP ${response.status}`);
  }
  const result = (await response.json()) as { accessToken: string };
  return {
    token: result.accessToken,
    authorization: { Authorization: `Bearer ${result.accessToken}` },
  };
}

/** Tạo máy khách HTTP nhỏ gọn cho API của ứng dụng */
export function api(token?: string) {
  return {
    request(path: string, init: RequestInit = {}) {
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      return fetch(new URL(path, baseUrl), { ...init, headers });
    },
    get(path: string, init: RequestInit = {}) {
      return this.request(path, { ...init, method: "GET" });
    },
    post(path: string, body?: unknown, init: RequestInit = {}) {
      return this.request(path, {
        ...init,
        method: "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    patch(path: string, body?: unknown, init: RequestInit = {}) {
      return this.request(path, {
        ...init,
        method: "PATCH",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    delete(path: string, init: RequestInit = {}) {
      return this.request(path, { ...init, method: "DELETE" });
    },
  };
}

/** Xóa dữ liệu do helper tạo ra và giữ nguyên dữ liệu seed cố định */
export async function resetData(prisma: TestDatabase) {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      test_period_ids uuid[] := ARRAY(SELECT id FROM evaluation_periods WHERE name LIKE 'TEST-%');
      test_unit_ids uuid[] := ARRAY(SELECT id FROM units WHERE code LIKE 'TEST-%');
      test_user_ids uuid[] := ARRAY(SELECT id FROM users WHERE username LIKE 'test-%');
      test_evaluation_ids uuid[] := ARRAY(
        SELECT id FROM evaluations
        WHERE period_id = ANY(test_period_ids) OR unit_id = ANY(test_unit_ids)
      );
    BEGIN
      ALTER TABLE audit_logs DISABLE TRIGGER USER;
      ALTER TABLE status_histories DISABLE TRIGGER USER;
      ALTER TABLE evidences DISABLE TRIGGER USER;
      DELETE FROM notification_deliveries WHERE notification_id IN (
        SELECT id FROM notifications WHERE user_id = ANY(test_user_ids)
      );
      DELETE FROM notification_preferences WHERE user_id = ANY(test_user_ids);
      DELETE FROM telegram_link_tokens WHERE user_id = ANY(test_user_ids);
      DELETE FROM telegram_bindings WHERE user_id = ANY(test_user_ids);
      DELETE FROM web_push_subscriptions WHERE user_id = ANY(test_user_ids);
      DELETE FROM notifications WHERE user_id = ANY(test_user_ids);
      DELETE FROM audit_logs WHERE actor_id = ANY(test_user_ids) OR entity_id = ANY(test_evaluation_ids::text[]);
      DELETE FROM report_exports WHERE evaluation_id = ANY(test_evaluation_ids) OR period_id = ANY(test_period_ids);
      DELETE FROM status_histories WHERE evaluation_id = ANY(test_evaluation_ids);
      DELETE FROM evaluation_feedbacks WHERE evaluation_id = ANY(test_evaluation_ids);
      DELETE FROM evidences WHERE criterion_score_id IN (
        SELECT id FROM criterion_scores WHERE evaluation_id = ANY(test_evaluation_ids)
      );
      DELETE FROM criterion_scores WHERE evaluation_id = ANY(test_evaluation_ids) OR criterion_id IN (
        SELECT id FROM criteria WHERE period_id = ANY(test_period_ids)
      );
      DELETE FROM evaluations WHERE id = ANY(test_evaluation_ids);
      DELETE FROM rating_thresholds WHERE period_id = ANY(test_period_ids);
      DELETE FROM criteria WHERE period_id = ANY(test_period_ids);
      DELETE FROM evaluation_periods WHERE id = ANY(test_period_ids);
      DELETE FROM refresh_tokens WHERE user_id = ANY(test_user_ids);
      DELETE FROM users WHERE id = ANY(test_user_ids);
      DELETE FROM units WHERE id = ANY(test_unit_ids);
      ALTER TABLE evidences ENABLE TRIGGER USER;
      ALTER TABLE status_histories ENABLE TRIGGER USER;
      ALTER TABLE audit_logs ENABLE TRIGGER USER;
    END $$;
  `);
}
