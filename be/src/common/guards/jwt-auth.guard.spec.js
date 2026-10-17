import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard, RolesGuard } from "./jwt-auth.guard.ts";

function createContext(request) {
  return {
    getHandler: () => "handler",
    getClass: () => "controller",
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

test("JWT guard resolves current role and unit from the database", async () => {
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

test("JWT guard rejects requests without a Bearer token", async () => {
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

test("roles guard rejects an authenticated user with the wrong role", () => {
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
