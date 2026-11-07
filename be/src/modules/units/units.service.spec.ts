import assert from "node:assert/strict";
import { test } from "node:test";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { UnitsService } from "./units.service.js";

type MockArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  skip?: number;
  take?: number;
  orderBy?: Record<string, unknown>;
};

type MockUnit = {
  id: string;
  code: string;
  name: string;
  unitType: string;
  sortOrder: number;
  isActive: boolean;
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

const OTHER_UNIT_ID = "44444444-4444-4444-8444-444444444444";

const UNIT: MockUnit = {
  id: UNIT_USER.unitId as string,
  code: "COSO-001",
  name: "Cơ sở 01",
  unitType: "DON_VI_TRUC_THUOC",
  sortOrder: 1,
  isActive: true,
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
    findMany: [] as MockArgs[],
    count: [] as MockArgs[],
    create: [] as MockArgs[],
    update: [] as MockArgs[],
    userFindMany: [] as MockArgs[],
  };

  const prismaMock = {
    unit: {
      findUnique: async (args: MockArgs) => {
        calls.findUnique.push(args);
        const where = args.where ?? {};

        if (where.id === UNIT.id || where.code === UNIT.code) {
          return UNIT;
        }

        return null;
      },

      findMany: async (args: MockArgs) => {
        calls.findMany.push(args);
        return [UNIT];
      },

      count: async (args: MockArgs) => {
        calls.count.push(args);
        return 1;
      },

      create: async (args: MockArgs) => {
        calls.create.push(args);
        return { ...UNIT, ...args.data };
      },

      update: async (args: MockArgs) => {
        calls.update.push(args);
        return { ...UNIT, ...args.data };
      },
    },

    user: {
      findMany: async (args: MockArgs) => {
        calls.userFindMany.push(args);
        return [];
      },
    },

    $transaction: async (operations: readonly Promise<unknown>[]) =>
      Promise.all(operations),
  };

  return {
    service: new UnitsService(prismaMock as never),
    calls,
  };
}

test("ADMIN can list units with pagination", async () => {
  const { service, calls } = makeService();

  const result = await service.findAll(ADMIN, {
    page: "1",
    pageSize: "10",
  } as never);

  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 10);
  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(calls.findMany[0]?.take, 10);
});

test("listing units rejects invalid pagination", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findAll(ADMIN, {
      page: "0",
      pageSize: "10",
    } as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("UNIT can retrieve its own unit", async () => {
  const { service } = makeService();

  const result = await service.findOne(UNIT.id, UNIT_USER);

  assert.equal(result.id, UNIT.id);
});

test("UNIT cannot retrieve another unit", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findOne(OTHER_UNIT_ID, UNIT_USER),
    (error: unknown) =>
      getStatus(error) === 403 || getStatus(error) === 404,
  );
});

test("creating a unit trims code and name", async () => {
  const { service, calls } = makeService();

  const result = await service.create({
    code: "  COSO-002  ",
    name: "  Cơ sở 02  ",
    sortOrder: 2,
  } as never);

  assert.equal(calls.create[0]?.data?.code, "COSO-002");
  assert.equal(calls.create[0]?.data?.name, "Cơ sở 02");
  assert.equal(result.code, "COSO-002");
  assert.equal(result.name, "Cơ sở 02");
});

test("creating a unit rejects an empty code", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.create({
      code: " ",
      name: "Cơ sở 02",
    } as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("updating a unit rejects an empty body", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.update(UNIT.id, {} as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("UNIT cannot list users of another unit", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findUsers(OTHER_UNIT_ID, UNIT_USER),
    (error: unknown) =>
      getStatus(error) === 403 || getStatus(error) === 404,
  );
});

test("ADMIN can list users belonging to a unit", async () => {
  const { service, calls } = makeService();

  const result = await service.findUsers(UNIT.id, ADMIN);

  assert.ok(result);
  assert.equal(calls.userFindMany.length, 1);
});

test("updating a unit ignores keys that are present but undefined", async () => {
  const { service, calls } = makeService();

  // Mô phỏng DTO sau ValidationPipe: mọi field khai báo đều là key, giá trị undefined.
  await service.update(UNIT.id, {
    code: undefined,
    name: "Tên mới",
    unitType: undefined,
    sortOrder: undefined,
    isActive: undefined,
  } as never);

  assert.equal(calls.update.length, 1);
  assert.equal(calls.update[0]?.data?.name, "Tên mới");
  assert.equal("code" in (calls.update[0]?.data ?? {}), false);
});

test("updating a missing unit returns 404", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.update(OTHER_UNIT_ID, { name: "X" } as never),
    (error: unknown) => getStatus(error) === 404,
  );
});

test("creating a unit with an existing code returns 409", async () => {
  const { service, calls } = makeService();

  await assert.rejects(
    service.create({ code: "COSO-001", name: "Trùng mã" } as never),
    (error: unknown) => getStatus(error) === 409,
  );
  assert.equal(calls.create.length, 0);
});

test("UNIT listing units only sees its own unit and does not query the whole table", async () => {
  const { service, calls } = makeService();

  const result = await service.findAll(UNIT_USER, {});

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, UNIT.id);
  assert.equal(calls.findMany.length, 0);
});

test("listing units rejects an invalid isActive filter", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findAll(ADMIN, { isActive: "maybe" } as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("listing units passes the unitType and isActive filters to the query", async () => {
  const { service, calls } = makeService();

  await service.findAll(ADMIN, { unitType: "DON_VI_TRUC_THUOC", isActive: "false" } as never);

  assert.deepEqual(calls.findMany[0]?.where, {
    unitType: "DON_VI_TRUC_THUOC",
    isActive: false,
  });
});

test("creating a unit defaults sortOrder to 0 and isActive to true", async () => {
  const { service, calls } = makeService();

  await service.create({ code: "COSO-009", name: "Cơ sở 09" } as never);

  assert.equal(calls.create[0]?.data?.sortOrder, 0);
  assert.equal(calls.create[0]?.data?.isActive, true);
});

test("creating a unit rejects a negative sortOrder", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.create({ code: "A", name: "B", sortOrder: -1 } as never),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("ADMIN can deactivate a unit", async () => {
  const { service, calls } = makeService();

  await service.update(UNIT.id, { isActive: false } as never);

  assert.equal(calls.update[0]?.data?.isActive, false);
});

test("creating a unit accepts each valid unitType", async () => {
  for (const [index, unitType] of [
    "CONG_AN_QUAN_HUYEN",
    "PHONG_NGHIEP_VU",
    "DON_VI_TRUC_THUOC",
  ].entries()) {
    const { service, calls } = makeService();

    await service.create({ code: `T-${index}`, name: "Thử", unitType } as never);

    assert.equal(calls.create[0]?.data?.unitType, unitType);
  }
});

test("creating a unit rejects an unknown unitType with 400 before touching the DB", async () => {
  const { service, calls } = makeService();

  await assert.rejects(
    service.create({ code: "T-9", name: "Thử", unitType: "ABC" } as never),
    (error: unknown) => getStatus(error) === 400,
  );
  assert.equal(calls.create.length, 0);
});

test("updating a unit rejects an unknown unitType", async () => {
  const { service, calls } = makeService();

  await assert.rejects(
    service.update(UNIT.id, { unitType: "ABC" } as never),
    (error: unknown) => getStatus(error) === 400,
  );
  assert.equal(calls.update.length, 0);
});

test("updating a unit can clear unitType with null", async () => {
  const { service, calls } = makeService();

  await service.update(UNIT.id, { unitType: null } as never);

  assert.equal(calls.update[0]?.data?.unitType, null);
});

test("listing units rejects an unknown unitType filter", async () => {
  const { service } = makeService();

  await assert.rejects(
    service.findAll(ADMIN, { unitType: "ABC" } as never),
    (error: unknown) => getStatus(error) === 400,
  );
});