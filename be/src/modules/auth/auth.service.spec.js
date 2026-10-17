import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service.ts";

async function makeService(overrides = {}) {
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
  const createdRefreshTokens = [];
  const updatedUsers = [];
  const prisma = {
    user: {
      findUnique: async () => user,
    },
    refreshToken: {
      create: async ({ data }) => createdRefreshTokens.push(data),
    },
    $transaction: async (callback) =>
      callback({
        refreshToken: {
          create: async ({ data }) => createdRefreshTokens.push(data),
        },
        user: {
          update: async ({ data }) => updatedUsers.push(data),
        },
      }),
    ...overrides.prisma,
  };
  const jwtService = {
    signAsync: async (payload, options) =>
      JSON.stringify({ payload, options, signed: true }),
    ...overrides.jwtService,
  };

  return {
    service: new AuthService(prisma, jwtService),
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
    createdRefreshTokens[0].tokenHash,
    createHash("sha256").update(result.refreshToken).digest("hex"),
  );
  assert.equal(createdRefreshTokens[0].tokenHash.includes(result.refreshToken), false);
  assert.equal(updatedUsers.length, 1);
});

test("login rejects invalid credentials without creating a session", async () => {
  const { service, createdRefreshTokens } = await makeService();

  await assert.rejects(
    service.login({ username: "admin", password: "wrong-password" }),
    (error) => error.getStatus() === 401 &&
      error.getResponse().code === "INVALID_CREDENTIALS",
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
    (error) => error.getStatus() === 400 &&
      error.getResponse().code === "VALIDATION_ERROR",
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
    (error) => error.getStatus() === 401 &&
      error.getResponse().code === "INVALID_CREDENTIALS",
  );
});
