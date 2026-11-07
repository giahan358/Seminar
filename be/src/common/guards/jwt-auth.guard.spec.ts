// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Cho phép bỏ qua kiểu của mock NestJS trong tệp kiểm thử
// @ts-nocheck -- Các mock của bài kiểm thử không triển khai đầy đủ hợp đồng NestJS
import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard, RolesGuard } from "./jwt-auth.guard.ts";

/** Tạo ngữ cảnh HTTP tối thiểu để gọi trực tiếp các guard */
function createContext(request) {
  return {
    getHandler: () => "handler",
    getClass: () => "controller",
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

/** Xác nhận guard lấy vai trò và đơn vị mới nhất từ cơ sở dữ liệu */
test("JWT guard lấy vai trò và đơn vị hiện tại từ cơ sở dữ liệu", async () => {
  const request = { headers: { authorization: "Bearer valid-token" } };
  const jwtService = {
    verifyAsync: async () => ({
      sub: "user-id",
      tokenUse: "access",
      role: "ADMIN",
      unitId: "forged-unit",
    }),
  };
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "user-id",
        role: "UNIT",
        unitId: "db-unit",
        isActive: true,
        unit: { isActive: true },
      }),
    },
  };
  const guard = new JwtAuthGuard(jwtService, prisma);

  assert.equal(await guard.canActivate(createContext(request)), true);
  assert.deepEqual(request.user, {
    id: "user-id",
    role: "UNIT",
    unitId: "db-unit",
  });
});

/** Xác nhận guard từ chối yêu cầu không có mã Bearer */
test("JWT guard từ chối yêu cầu không có mã Bearer", async () => {
  const request = { headers: {} };
  const guard = new JwtAuthGuard(
    { verifyAsync: async () => ({}) },
    { user: { findUnique: async () => null } },
  );

  await assert.rejects(
    guard.canActivate(createContext(request)),
    UnauthorizedException,
  );
});

/** Xác nhận guard vai trò từ chối người dùng không đủ quyền */
test("guard vai trò từ chối người dùng không có vai trò phù hợp", () => {
  const request = {
    user: { id: "unit-user", role: "UNIT", unitId: "unit-id" },
  };
  const reflector = {
    getAllAndOverride: () => ["ADMIN"],
  };
  const guard = new RolesGuard(reflector);

  assert.throws(
    () => guard.canActivate(createContext(request)),
    ForbiddenException,
  );
});
