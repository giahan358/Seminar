import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard, RolesGuard } from "./jwt-auth.guard.js";

type FakeRequest = {
  headers: { authorization?: string };
  user?: unknown;
};

function createContext(request: unknown) {
  return {
    getHandler: () => "handler",
    getClass: () => "controller",
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

test("JWT guard resolves current role and unit from the database", async () => {
  const request: FakeRequest = { headers: { authorization: "Bearer valid-token" } };
  const jwtService = {
    verifyAsync: async () => ({
      sub: "11111111-1111-4111-8111-111111111111",
      tokenUse: "access", ver: 0, exp: Date.now() / 1000 + 900,
      role: "ADMIN",
      unitId: "forged-unit",
    }),
  };
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "11111111-1111-4111-8111-111111111111",
        role: "UNIT",
        unitId: "db-unit",
        isActive: true, credentialVersion: 0,
        unit: { isActive: true },
      }),
    },
  };
  const guard = new JwtAuthGuard(jwtService as never, prisma as never);

  assert.equal(await guard.canActivate(createContext(request)), true);
  assert.deepEqual(request.user, {
    id: "11111111-1111-4111-8111-111111111111",
    role: "UNIT",
    unitId: "db-unit",
  });
});

test("JWT guard rejects requests without a Bearer token", async () => {
  const request: FakeRequest = { headers: {} };
  const guard = new JwtAuthGuard(
    { verifyAsync: async () => ({}) } as never,
    { user: { findUnique: async () => null } } as never,
  );

  await assert.rejects(
    guard.canActivate(createContext(request)),
    UnauthorizedException,
  );
});

test("roles guard rejects an authenticated user with the wrong role", () => {
  const request: FakeRequest = {
    headers: {},
    user: { id: "unit-user", role: "UNIT", unitId: "unit-id" },
  };
  const reflector = {
    getAllAndOverride: () => ["ADMIN"],
  };
  const guard = new RolesGuard(reflector as never);

  assert.throws(
    () => guard.canActivate(createContext(request)),
    ForbiddenException,
  );
});

test("JWT guard rejects a deactivated account even with a valid token", async () => {
  const request: FakeRequest = { headers: { authorization: "Bearer valid-token" } };
  const guard = new JwtAuthGuard(
    { verifyAsync: async () => ({ sub: "11111111-1111-4111-8111-111111111111", tokenUse: "access" }) } as never,
    {
      user: {
        findUnique: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          role: "ADMIN",
          unitId: null,
          isActive: false,
          unit: null,
        }),
      },
    } as never,
  );

  await assert.rejects(
    guard.canActivate(createContext(request)),
    UnauthorizedException,
  );
});

test("JWT guard rejects a refresh-style token that is not an access token", async () => {
  const request: FakeRequest = { headers: { authorization: "Bearer valid-token" } };
  const guard = new JwtAuthGuard(
    { verifyAsync: async () => ({ sub: "11111111-1111-4111-8111-111111111111", tokenUse: "refresh" }) } as never,
    { user: { findUnique: async () => null } } as never,
  );

  await assert.rejects(
    guard.canActivate(createContext(request)),
    UnauthorizedException,
  );
});

test("roles guard allows a request when no roles are required", () => {
  const guard = new RolesGuard({ getAllAndOverride: () => undefined } as never);

  assert.equal(guard.canActivate(createContext({ headers: {} })), true);
});
/** Version thiếu hoặc lệch, exp thiếu và sub sai UUID phải bị từ chối trước query nghiệp vụ */
test("Guard từ chối claim thiếu hoặc lỗi và version cũ", async () => {
  for (const payload of [
    { sub: "11111111-1111-4111-8111-111111111111", tokenUse: "access", exp: Date.now() / 1000 + 900 },
    { sub: "sai-uuid", tokenUse: "access", ver: 0, exp: Date.now() / 1000 + 900 },
    { sub: "11111111-1111-4111-8111-111111111111", tokenUse: "access", ver: 0 },
    { sub: "11111111-1111-4111-8111-111111111111", tokenUse: "access", ver: 0, exp: Date.now() / 1000 + 900 },
  ]) {
    const guard = new JwtAuthGuard({ verifyAsync: async () => payload } as never, { user: { findUnique: async () => ({ isActive: true, credentialVersion: 1 }) } } as never);
    await assert.rejects(guard.canActivate(createContext({ headers: { authorization: "Bearer token" } })), UnauthorizedException);
  }
});
/** Cờ bắt đổi được kiểm sau JWT/DB và trước RolesGuard, chỉ metadata của handler được phép mở đường đổi mật khẩu */
test("Guard chặn nghiệp vụ và cho phép handler đổi mật khẩu", async () => {
  const handler = () => undefined;
  const guard = new JwtAuthGuard({ verifyAsync: async () => ({ sub: "11111111-1111-4111-8111-111111111111", tokenUse: "access", ver: 0, exp: Date.now() / 1000 + 900 }) } as never,
    { user: { findUnique: async () => ({ id: "11111111-1111-4111-8111-111111111111", isActive: true, credentialVersion: 0, mustChangePassword: true, role: "ADMIN", unitId: null }) } } as never);
  const context = { switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: "Bearer token" } }) }), getHandler: () => handler } as never;
  await assert.rejects(guard.canActivate(context), ForbiddenException);
  Reflect.defineMetadata("auth:allow-password-change", true, handler);
  assert.equal(await guard.canActivate(context), true);
});
