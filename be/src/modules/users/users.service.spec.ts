import assert from "node:assert/strict";
import { test } from "node:test";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { UsersService } from "./users.service.js";

type MockArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  skip?: number;
  take?: number;
  orderBy?: Record<string, unknown>;
  select?: Record<string, unknown>;
};

type MockUser = {
  id: string;
  username: string;
  passwordHash: string;
  mustChangePassword: boolean;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  unitId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const ADMIN: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "ADMIN",
  unitId: null,
};

const UNIT_USER: CurrentUser = {
  id: "22222222-2222-4222-8222-222222222222",
  role: "UNIT",
  unitId: "33333333-3333-4333-8333-333333333333",
};

const OTHER_UNIT_USER: CurrentUser = {
  id: "44444444-4444-4444-8444-444444444444",
  role: "UNIT",
  unitId: "55555555-5555-4555-8555-555555555555",
};

const USER: MockUser = {
  id: UNIT_USER.id,
  username: "unit01",
  passwordHash: "$2b$10$testHash",
  mustChangePassword: false,
  fullName: "Nguyễn Văn A",
  email: "unit01@example.com",
  phone: "0900000001",
  role: "UNIT",
  unitId: UNIT_USER.unitId,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function getStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "getStatus" in error &&
    typeof error.getStatus === "function"
  ) {
    return error.getStatus();
  }

  return undefined;
}

function makeService() {
  const calls = {
    findUnique: [] as MockArgs[],
    findFirst: [] as MockArgs[],
    findMany: [] as MockArgs[],
    count: [] as MockArgs[],
    create: [] as MockArgs[],
    update: [] as MockArgs[],
  };

  const prismaMock = {
  user: {
    findUnique: async (args: MockArgs) => {
  calls.findUnique.push(args);
  const where = args.where ?? {};

  if (
    where.id === USER.id ||
    where.username === USER.username ||
    where.email === USER.email
  ) {
    if (args.select) {
      return Object.fromEntries(
        Object.entries(args.select)
          .filter(([, selected]) => selected === true)
          .map(([key]) => [
            key,
            USER[key as keyof typeof USER],
          ]),
      );
    }

    return USER;
  }

  return null;
},

    findFirst: async (args: MockArgs) => {
        calls.findFirst.push(args);
        return null;
    },

    findMany: async (args: MockArgs) => {
      calls.findMany.push(args);
      return [USER];
    },

    count: async (args: MockArgs) => {
      calls.count.push(args);
      return 1;
    },

    create: async (args: MockArgs) => {
      calls.create.push(args);
      return { ...USER, ...args.data };
    },

    update: async (args: MockArgs) => {
      calls.update.push(args);
      return { ...USER, ...args.data };
    },
  },

  unit: {
    findUnique: async () => ({
      id: UNIT_USER.unitId,
      isActive: true,
    }),
  },

  refreshToken: {
    updateMany: async () => ({ count: 1 }),
  },

  $transaction: async (operations: unknown) => {
    if (typeof operations === "function") {
      return operations(prismaMock);
    }

    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }

    throw new TypeError("Unsupported transaction type");
  },
};

  return {
    service: new UsersService(prismaMock as never),
    calls,
  };
}

test("ADMIN can list users with pagination", async () => {
  const { service, calls } = makeService();

  const result = await service.findAll({
    page: "1",
    pageSize: "10",
  } as never);

  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 10);
  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(calls.findMany[0]?.take, 10);
});

test("listing users rejects invalid pagination", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findAll({
      page: "0",
      pageSize: "10",
    } as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("ADMIN can retrieve a user by ID", async () => {
  const { service } = makeService();

  const result = await service.findOne(USER.id, ADMIN);

  assert.equal(result.id, USER.id);
  assert.equal("passwordHash" in result, false);
});

test("UNIT can retrieve its own account", async () => {
  const { service } = makeService();

  const result = await service.findOne(USER.id, UNIT_USER);

  assert.equal(result.id, USER.id);
});

test("UNIT cannot retrieve another unit's account", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findOne(OTHER_UNIT_USER.id, UNIT_USER),
    (error: unknown) =>
      getStatus(error) === 403 || getStatus(error) === 404,
  );
});

test("creating a user trims username and full name", async () => {
  const { service, calls } = makeService();

  const result = await service.create({
    username: "  unit02  ",
    password: "TestPassword123!",
    fullName: "  Nguyễn Văn B  ",
    email: "unit02@example.com",
    role: "UNIT",
    unitId: UNIT_USER.unitId,
  } as never);

  const createData = calls.create[0]?.data;

  assert.equal(createData?.username, "unit02");
  assert.equal(createData?.fullName, "Nguyễn Văn B");
  assert.equal(result.username, "unit02");
});

test("updating a user rejects an empty body", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.update(USER.id, ADMIN, {} as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("resetPassword returns a result", async () => {
  const { service } = makeService();

  const result = await service.resetPassword(USER.id);
  assert.ok(result);
});

test("updateStatus updates the account status", async () => {
  const { service, calls } = makeService();

  await service.updateStatus(USER.id, false, ADMIN);

  assert.equal(calls.update.length, 1);
  assert.equal(calls.update[0]?.data?.isActive, false);
});

test("UNIT can update its own fullName", async () => {
  const { service, calls } = makeService();

  await service.update(USER.id, UNIT_USER, { fullName: "  Tên mới  " } as never);

  assert.equal(calls.update[0]?.data?.fullName, "Tên mới");
});

test("UNIT cannot change its own role (403)", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.update(USER.id, UNIT_USER, { role: "ADMIN" } as never),
    (error: unknown) => getStatus(error) === 403,
  );
});

test("UNIT cannot update another account (404)", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.update(OTHER_UNIT_USER.id, UNIT_USER, { fullName: "X" } as never),
    (error: unknown) => getStatus(error) === 404,
  );
});

test("update ignores keys that are present but undefined", async () => {
  const { service, calls } = makeService();

  // Mô phỏng DTO sau ValidationPipe: mọi field khai báo đều là key, giá trị undefined.
  await service.update(USER.id, UNIT_USER, {
    fullName: "Tên mới",
    email: undefined,
    phone: undefined,
    role: undefined,
    unitId: undefined,
    isActive: undefined,
  } as never);

  assert.equal(calls.update.length, 1);
  assert.equal("role" in (calls.update[0]?.data ?? {}), false);
});

test("ADMIN editing only fullName does not touch role or unit", async () => {
  const { service, calls } = makeService();

  await service.update(USER.id, ADMIN, { fullName: "Tên mới" } as never);

  const data = calls.update[0]?.data ?? {};
  assert.equal("role" in data, false);
  assert.equal("unitId" in data, false);
});

test("ADMIN cannot deactivate their own account (422)", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.updateStatus(ADMIN.id, false, ADMIN),
    (error: unknown) => getStatus(error) === 422,
  );
});

test("ADMIN cannot demote themselves through PATCH (422)", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.update(ADMIN.id, ADMIN, {
      role: "UNIT",
      unitId: UNIT_USER.unitId,
    } as never),
    (error: unknown) => getStatus(error) === 422,
  );
});

test("PATCH no longer accepts isActive: locking goes through /status (400)", async () => {
  const { service, calls } = makeService();

  await assert.rejects(
    service.update(USER.id, ADMIN, { isActive: false } as never),
    (error: unknown) => getStatus(error) === 400,
  );
  assert.equal(calls.update.length, 0);
});

test("listing users rejects a non-UUID unitId filter", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findAll({ unitId: "not-a-uuid" } as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("creating a user with an existing username returns 409", async () => {
  const { service, calls } = makeService();

  await assert.rejects(
    service.create({
      username: "unit01",
      fullName: "Trùng username",
      role: "UNIT",
      unitId: UNIT_USER.unitId,
    } as never),
    (error: unknown) => getStatus(error) === 409,
  );
  assert.equal(calls.create.length, 0);
});

test("creating an ADMIN with a unitId is rejected", async () => {
  const { service, calls } = makeService();

  await assert.rejects(
    service.create({
      username: "admin2",
      fullName: "Admin 2",
      role: "ADMIN",
      unitId: UNIT_USER.unitId,
    } as never),
    (error: unknown) => getStatus(error) === 400,
  );
  assert.equal(calls.create.length, 0);
});

test("creating a UNIT account without a unitId is rejected", async () => {
  const { service, calls } = makeService();

  await assert.rejects(
    service.create({ username: "coso99", fullName: "Cơ sở 99", role: "UNIT" } as never),
    (error: unknown) => getStatus(error) === 400,
  );
  assert.equal(calls.create.length, 0);
});

test("creating a user always sets mustChangePassword and returns a temporary password once", async () => {
  const { service, calls } = makeService();

  const result = await service.create({
    username: "coso77",
    fullName: "Cơ sở 77",
    role: "UNIT",
    unitId: UNIT_USER.unitId,
  } as never);

  const data = calls.create[0]?.data ?? {};
  assert.equal(data.mustChangePassword, true);
  assert.equal(typeof result.temporaryPassword, "string");
  assert.ok(result.temporaryPassword.length >= 12);
  // DB chỉ lưu bản băm, không lưu mật khẩu tạm.
  assert.notEqual(data.passwordHash, result.temporaryPassword);
  assert.match(String(data.passwordHash), /^\$2[aby]\$/);
});

test("creating an ADMIN account stores no unitId", async () => {
  const { service, calls } = makeService();

  await service.create({
    username: "admin2",
    fullName: "Admin 2",
    role: "ADMIN",
  } as never);

  assert.equal(calls.create[0]?.data?.unitId, null);
  assert.equal(calls.create[0]?.data?.role, "ADMIN");
});

test("listing users passes role and isActive filters to the query", async () => {
  const { service, calls } = makeService();

  await service.findAll({ role: "UNIT", isActive: "true" } as never);

  assert.deepEqual(calls.findMany[0]?.where, { role: "UNIT", isActive: true });
});

test("listing users rejects an unknown role filter", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findAll({ role: "SUPERUSER" } as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("resetPassword returns a fresh temporary password and forces a password change", async () => {
  const { service, calls } = makeService();

  const result = await service.resetPassword(USER.id);

  assert.equal(result.mustChangePassword, true);
  assert.ok(result.temporaryPassword.length >= 12);
  assert.equal(calls.update[0]?.data?.mustChangePassword, true);
  assert.match(String(calls.update[0]?.data?.passwordHash), /^\$2[aby]\$/);
});

test("resetPassword on a missing user returns 404", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.resetPassword("99999999-9999-4999-8999-999999999999"),
    (error: unknown) => getStatus(error) === 404,
  );
});

test("updateStatus rejects a non-boolean value", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.updateStatus(USER.id, "false" as never, ADMIN),
    (error: unknown) => getStatus(error) === 400,
  );
});