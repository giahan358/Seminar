import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service.js";

type Row = Record<string, unknown>;
type Overrides = {
  prisma?: Record<string, unknown>;
  jwtService?: Record<string, unknown>;
};
type HttpError = { getStatus(): number; getResponse(): { code?: string } };

// Ép lỗi bắt được trong assert.rejects về dạng HttpException để đọc status và code.
const http = (error: unknown): HttpError => error as HttpError;

async function makeService(overrides: Overrides = {}) {
  const passwordHash = await bcrypt.hash("correct-password", 4);
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    username: "admin",
    passwordHash,
    fullName: "Admin",
    role: "ADMIN",
    unitId: null,
    isActive: true,
    mustChangePassword: true,
    unit: null,
  };
  const createdRefreshTokens: Row[] = [];
  const updatedUsers: Row[] = [];
  const prisma = {
    user: {
      findUnique: async () => user,
    },
    refreshToken: {
      create: async ({ data }: { data: Row }) => createdRefreshTokens.push(data),
    },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        refreshToken: {
          create: async ({ data }: { data: Row }) => createdRefreshTokens.push(data),
        },
        user: {
          update: async ({ data }: { data: Row }) => updatedUsers.push(data),
        },
      }),
    ...overrides.prisma,
  };
  const jwtService = {
    signAsync: async (payload: unknown, options: unknown) =>
      JSON.stringify({ payload, options, signed: true }),
    ...overrides.jwtService,
  };

  return {
    service: new AuthService(prisma as never, jwtService as never),
    user,
    createdRefreshTokens,
    updatedUsers,
  };
}

test("login returns safe user data and stores only a hash of the refresh token", async () => {
  const { service, user, createdRefreshTokens, updatedUsers } =
    await makeService();

  const result = await service.login({
    username: " admin ",
    password: "correct-password",
  });

  assert.equal(result.user.id, user.id);
  assert.equal(result.user.mustChangePassword, true);
  assert.equal("passwordHash" in result.user, false);
  assert.equal(result.tokenType, "Bearer");
  assert.equal(result.expiresIn, 900);
  assert.equal(createdRefreshTokens.length, 1);
  assert.equal(
    createdRefreshTokens[0]?.tokenHash,
    createHash("sha256").update(result.refreshToken).digest("hex"),
  );
  assert.equal(String(createdRefreshTokens[0]?.tokenHash).includes(result.refreshToken), false);
  assert.equal(updatedUsers.length, 1);
});

test("login rejects invalid credentials without creating a session", async () => {
  const { service, createdRefreshTokens } = await makeService();

  await assert.rejects(
    service.login({ username: "admin", password: "wrong-password" }),
    (error: unknown) => http(error).getStatus() === 401 &&
      http(error).getResponse().code === "UNAUTHORIZED",
  );
  assert.equal(createdRefreshTokens.length, 0);
});

test("login rejects missing fields before querying users", async () => {
  let lookupCount = 0;
  const { service } = await makeService({
    prisma: {
      user: {
        findUnique: async () => {
          lookupCount += 1;
          return null;
        },
      },
    },
  });

  await assert.rejects(
    service.login({ username: "", password: "password" }),
    (error: unknown) => http(error).getStatus() === 400 &&
      http(error).getResponse().code === "VALIDATION_ERROR",
  );
  assert.equal(lookupCount, 0);
});

test("login rejects inactive accounts", async () => {
  const { service } = await makeService({
    prisma: {
      user: {
        findUnique: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          username: "admin",
          passwordHash: await bcrypt.hash("correct-password", 4),
          fullName: "Admin",
          role: "ADMIN",
          unitId: null,
          isActive: false,
          mustChangePassword: true,
          unit: null,
        }),
      },
    },
  });

  await assert.rejects(
    service.login({ username: "admin", password: "correct-password" }),
    (error: unknown) => http(error).getStatus() === 401 &&
      http(error).getResponse().code === "UNAUTHORIZED",
  );
});

test("refresh rejects a missing refresh token", async () => {
  const { service } = await makeService();

  await assert.rejects(
    service.refresh({ refreshToken: "" }),
    (error: unknown) =>
      http(error).getStatus() === 400 &&
      http(error).getResponse().code === "VALIDATION_ERROR",
  );
});

test("refresh rejects an unknown refresh token", async () => {
  const { service } = await makeService({
    prisma: {
      refreshToken: {
        findUnique: async () => null,
      },
    },
  });

  await assert.rejects(
    service.refresh({ refreshToken: "unknown-token" }),
    (error: unknown) =>
      http(error).getStatus() === 401 &&
      http(error).getResponse().code === "INVALID_REFRESH_TOKEN",
  );
});

test("logout succeeds when the refresh token is already unknown or revoked", async () => {
  let updateManyCalled = false;

  const { service } = await makeService({
    prisma: {
      refreshToken: {
        updateMany: async () => {
          updateManyCalled = true;
          return { count: 0 };
        },
      },
    },
  });

  const result = await service.logout({
    refreshToken: "already-revoked-token",
  });

  assert.deepEqual(result, { success: true });
  assert.equal(updateManyCalled, true);
});

test("change password rejects a new password shorter than eight characters", async () => {
  const { service } = await makeService();

  await assert.rejects(
    service.changePassword(
      {
        id: "11111111-1111-4111-8111-111111111111",
        role: "ADMIN",
        unitId: null,
      },
      {
        currentPassword: "correct-password",
        newPassword: "short",
      },
    ),
    (error: unknown) =>
      http(error).getStatus() === 400 &&
      http(error).getResponse().code === "VALIDATION_ERROR",
  );
});

test("refresh rotates the token: revokes the old one and stores only the new hash", async () => {
  const oldToken = "old-refresh-token";
  const revokedIds: unknown[] = [];
  const { service, user, createdRefreshTokens } = await makeService({
    prisma: {
      refreshToken: {
        findUnique: async () => ({
          id: "22222222-2222-4222-8222-222222222222",
          userId: "11111111-1111-4111-8111-111111111111",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        }),
      },
      $transaction: async (callback: (tx: unknown) => unknown) => {
        const created: Row[] = [];
        const result = await callback({
          refreshToken: {
            updateMany: async ({ where }: { where: Row }) => {
              revokedIds.push(where.id);
              return { count: 1 };
            },
            create: async ({ data }: { data: Row }) => created.push(data),
          },
        });
        createdRefreshTokens.push(...created);
        return result;
      },
    },
  });

  const result = await service.refresh({ refreshToken: oldToken });

  assert.equal(result.user.id, user.id);
  assert.notEqual(result.refreshToken, oldToken);
  assert.equal(revokedIds.length, 1);
  assert.equal(createdRefreshTokens.length, 1);
  assert.equal(
    createdRefreshTokens[0]?.tokenHash,
    createHash("sha256").update(result.refreshToken).digest("hex"),
  );
});

test("refresh rejects an already revoked refresh token", async () => {
  const { service } = await makeService({
    prisma: {
      refreshToken: {
        findUnique: async () => ({
          id: "22222222-2222-4222-8222-222222222222",
          userId: "11111111-1111-4111-8111-111111111111",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: new Date(),
        }),
      },
    },
  });

  await assert.rejects(
    service.refresh({ refreshToken: "revoked-token" }),
    (error: unknown) =>
      http(error).getStatus() === 401 &&
      http(error).getResponse().code === "INVALID_REFRESH_TOKEN",
  );
});

test("change password rejects a wrong current password with 400", async () => {
  const { service } = await makeService();

  await assert.rejects(
    service.changePassword(
      { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN", unitId: null },
      { currentPassword: "wrong-password", newPassword: "new-password-123" },
    ),
    (error: unknown) =>
      http(error).getStatus() === 400 &&
      http(error).getResponse().code === "VALIDATION_ERROR",
  );
});

test("change password updates the hash, clears mustChangePassword and revokes refresh tokens", async () => {
  const userUpdates: Row[] = [];
  const revokeCalls: unknown[] = [];
  const { service } = await makeService({
    prisma: {
      $transaction: async (callback: (tx: unknown) => unknown) =>
        callback({
          user: { update: async ({ data }: { data: Row }) => userUpdates.push(data) },
          refreshToken: {
            updateMany: async (args: unknown) => {
              revokeCalls.push(args);
              return { count: 1 };
            },
          },
        }),
    },
  });

  const result = await service.changePassword(
    { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN", unitId: null },
    { currentPassword: "correct-password", newPassword: "new-password-123" },
  );

  assert.equal(userUpdates.length, 1);
  assert.equal(userUpdates[0]?.mustChangePassword, false);
  assert.equal(await bcrypt.compare("new-password-123", String(userUpdates[0]?.passwordHash)), true);
  assert.equal(revokeCalls.length, 1);
  assert.equal("passwordHash" in result, false);
});

test("getMe returns the profile with its unit and no secrets", async () => {
  const unitUser = {
    id: "33333333-3333-4333-8333-333333333333",
    username: "coso01",
    fullName: "Cơ sở 01",
    role: "UNIT",
    unitId: "44444444-4444-4444-8444-444444444444",
    isActive: true,
    mustChangePassword: false,
    unit: {
      id: "44444444-4444-4444-8444-444444444444",
      code: "COSO-01",
      name: "Cơ sở Đoàn 01",
      unitType: null,
      isActive: true,
    },
  };
  const { service } = await makeService({
    prisma: { user: { findUnique: async () => unitUser } },
  });

  const me = await service.getMe(unitUser.id);

  assert.equal(me.unit?.code, "COSO-01");
  assert.equal("isActive" in (me.unit ?? {}), false);
  assert.equal("passwordHash" in me, false);
});

test("login rejects a UNIT account whose unit is deactivated", async () => {
  const passwordHash = await bcrypt.hash("correct-password", 4);
  const { service, createdRefreshTokens } = await makeService({
    prisma: {
      user: {
        findUnique: async () => ({
          id: "55555555-5555-4555-8555-555555555555",
          username: "coso01",
          passwordHash,
          fullName: "Cơ sở 01",
          role: "UNIT",
          unitId: "66666666-6666-4666-8666-666666666666",
          isActive: true,
          mustChangePassword: false,
          unit: { isActive: false },
        }),
      },
    },
  });

  await assert.rejects(
    service.login({ username: "coso01", password: "correct-password" }),
    (error: unknown) => http(error).getStatus() === 401 &&
      http(error).getResponse().code === "UNAUTHORIZED",
  );
  assert.equal(createdRefreshTokens.length, 0);
});

test("login returns the same 401 for an unknown username", async () => {
  const { service } = await makeService({
    prisma: { user: { findUnique: async () => null } },
  });

  await assert.rejects(
    service.login({ username: "ghost", password: "whatever-123" }),
    (error: unknown) => http(error).getStatus() === 401 &&
      http(error).getResponse().code === "UNAUTHORIZED",
  );
});

test("change password rejects a new password equal to the current one", async () => {
  const { service } = await makeService();

  await assert.rejects(
    service.changePassword(
      { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN", unitId: null },
      { currentPassword: "same-password-1", newPassword: "same-password-1" },
    ),
    (error: unknown) =>
      http(error).getStatus() === 400 &&
      http(error).getResponse().code === "VALIDATION_ERROR",
  );
});

test("change password rejects a new password longer than 72 characters", async () => {
  const { service } = await makeService();

  await assert.rejects(
    service.changePassword(
      { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN", unitId: null },
      { currentPassword: "correct-password", newPassword: "a".repeat(73) },
    ),
    (error: unknown) => http(error).getStatus() === 400,
  );
});