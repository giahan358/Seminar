import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { AUTHORIZED_ROLES } from "../../common/decorators/roles.decorator.js";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { JwtAuthGuard, RolesGuard } from "../../common/guards/jwt-auth.guard.js";
import { CreateUnitDto } from "./dto/create-unit.dto.js";
import { UpdateUnitDto } from "./dto/update-unit.dto.js";
import { UnitsController } from "./units.controller.js";

const ADMIN: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "ADMIN",
  unitId: null,
};

const UNIT_ID = "33333333-3333-4333-8333-333333333333";

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

function makeController() {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => async (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return { handledBy: name };
  };
  const service = {
    findAll: record("findAll"),
    findOne: record("findOne"),
    findUsers: record("findUsers"),
    create: record("create"),
    update: record("update"),
  };
  return { controller: new UnitsController(service as never), calls };
}

async function validate<T extends object>(
  dtoClass: new () => T,
  body: unknown,
): Promise<T> {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    expectedType: dtoClass,
  });
  return pipe.transform(body, { type: "body", metatype: dtoClass });
}

function rolesOf(handler: object): unknown {
  return Reflect.getMetadata(AUTHORIZED_ROLES, handler);
}

// ---------- Chuyển tiếp xuống service ----------

test("findAll forwards the current user and all query filters", async () => {
  const { controller, calls } = makeController();

  await controller.findAll(ADMIN, "2", "10", "DON_VI_TRUC_THUOC", "true");

  assert.deepEqual(calls.findAll?.[0], [
    ADMIN,
    { page: "2", pageSize: "10", unitType: "DON_VI_TRUC_THUOC", isActive: "true" },
  ]);
});

test("create forwards the dto", async () => {
  const { controller, calls } = makeController();
  const dto = { code: "COSO-001", name: "Cơ sở 01" } as CreateUnitDto;

  await controller.create(dto);

  assert.deepEqual(calls.create?.[0], [dto]);
});

test("findOne forwards id and current user", async () => {
  const { controller, calls } = makeController();

  await controller.findOne(UNIT_ID, ADMIN);

  assert.deepEqual(calls.findOne?.[0], [UNIT_ID, ADMIN]);
});

test("findUsers forwards id and current user", async () => {
  const { controller, calls } = makeController();

  await controller.findUsers(UNIT_ID, ADMIN);

  assert.deepEqual(calls.findUsers?.[0], [UNIT_ID, ADMIN]);
});

test("update forwards id and dto", async () => {
  const { controller, calls } = makeController();
  const dto = { name: "Tên mới" } as UpdateUnitDto;

  await controller.update(UNIT_ID, dto);

  assert.deepEqual(calls.update?.[0], [UNIT_ID, dto]);
});

// ---------- Bảo vệ route và phân quyền ----------

test("the whole controller requires JwtAuthGuard and RolesGuard", () => {
  assert.deepEqual(Reflect.getMetadata("__guards__", UnitsController), [
    JwtAuthGuard,
    RolesGuard,
  ]);
});

test("only ADMIN can create and update units", () => {
  assert.deepEqual(rolesOf(UnitsController.prototype.create), ["ADMIN"]);
  assert.deepEqual(rolesOf(UnitsController.prototype.update), ["ADMIN"]);
});

test("ADMIN and UNIT can read units", () => {
  for (const handler of [
    UnitsController.prototype.findAll,
    UnitsController.prototype.findOne,
    UnitsController.prototype.findUsers,
  ]) {
    assert.deepEqual(rolesOf(handler), ["ADMIN", "UNIT"]);
  }
});

// ---------- Kiểm tra DTO ----------

test("CreateUnitDto accepts a valid unit and strips unknown fields", async () => {
  const dto = await validate(CreateUnitDto, {
    code: "COSO-001",
    name: "Cơ sở 01",
    sortOrder: 1,
    isActive: true,
    id: "client-supplied-id",
  });

  assert.equal(dto.code, "COSO-001");
  assert.equal("id" in dto, false);
});

test("CreateUnitDto rejects an empty code", async () => {
  await assert.rejects(
    validate(CreateUnitDto, { code: "", name: "Cơ sở 01" }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("CreateUnitDto rejects a negative sortOrder", async () => {
  await assert.rejects(
    validate(CreateUnitDto, { code: "A", name: "B", sortOrder: -1 }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("CreateUnitDto rejects a non-boolean isActive", async () => {
  await assert.rejects(
    validate(CreateUnitDto, { code: "A", name: "B", isActive: "yes" }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("UpdateUnitDto accepts a partial body", async () => {
  const dto = await validate(UpdateUnitDto, { name: "Tên mới" });

  assert.equal(dto.name, "Tên mới");
});

test("UpdateUnitDto rejects a blank name", async () => {
  await assert.rejects(
    validate(UpdateUnitDto, { name: "" }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("CreateUnitDto accepts each of the 3 unit types", async () => {
  for (const unitType of ["CONG_AN_QUAN_HUYEN", "PHONG_NGHIEP_VU", "DON_VI_TRUC_THUOC"]) {
    const dto = await validate(CreateUnitDto, { code: "A", name: "B", unitType });

    assert.equal(dto.unitType, unitType);
  }
});

test("CreateUnitDto rejects an unknown unit type", async () => {
  await assert.rejects(
    validate(CreateUnitDto, { code: "A", name: "B", unitType: "ABC" }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("UpdateUnitDto accepts a null unitType and rejects an unknown one", async () => {
  const dto = await validate(UpdateUnitDto, { unitType: null });
  assert.equal(dto.unitType, null);

  await assert.rejects(
    validate(UpdateUnitDto, { unitType: "ABC" }),
    (error: unknown) => getStatus(error) === 400,
  );
});