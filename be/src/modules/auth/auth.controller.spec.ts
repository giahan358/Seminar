import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { AuthController } from "./auth.controller.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";

const CURRENT_USER: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "ADMIN",
  unitId: null,
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

function makeController() {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => async (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return { handledBy: name };
  };
  const service = {
    login: record("login"),
    getMe: record("getMe"),
    refresh: record("refresh"),
    logout: record("logout"),
    changePassword: record("changePassword"),
  };
  return { controller: new AuthController(service as never), calls };
}

// Chạy DTO qua ValidationPipe giống khi Nest xử lý request thật.
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

function guardsOf(handler: object): unknown[] {
  return Reflect.getMetadata("__guards__", handler) ?? [];
}

function httpCodeOf(handler: object): number | undefined {
  return Reflect.getMetadata("__httpCode__", handler);
}

// ---------- Chuyển tiếp xuống service ----------

test("login forwards the body to AuthService.login", async () => {
  const { controller, calls } = makeController();
  const body = { username: "admin", password: "secret" } as LoginDto;

  const result = await controller.login(body);

  assert.deepEqual(result, { handledBy: "login" });
  assert.deepEqual(calls.login?.[0], [body]);
});

test("getMe passes the current user's id", async () => {
  const { controller, calls } = makeController();

  await controller.getMe(CURRENT_USER);

  assert.deepEqual(calls.getMe?.[0], [CURRENT_USER.id]);
});

test("refresh forwards the body to AuthService.refresh", async () => {
  const { controller, calls } = makeController();
  const body = { refreshToken: "abc" } as RefreshTokenDto;

  await controller.refresh(body);

  assert.deepEqual(calls.refresh?.[0], [body]);
});

test("logout forwards the body to AuthService.logout", async () => {
  const { controller, calls } = makeController();
  const body = { refreshToken: "abc" } as RefreshTokenDto;

  await controller.logout(body);

  assert.deepEqual(calls.logout?.[0], [body]);
});

test("changePassword passes the current user and the body", async () => {
  const { controller, calls } = makeController();
  const body = {
    currentPassword: "old-password",
    newPassword: "new-password-123",
  } as ChangePasswordDto;

  await controller.changePassword(CURRENT_USER, body);

  assert.deepEqual(calls.changePassword?.[0], [CURRENT_USER, body]);
});

// ---------- Bảo vệ route ----------

test("login, refresh and logout are public (no guard)", () => {
  assert.equal(guardsOf(AuthController.prototype.login).length, 0);
  assert.equal(guardsOf(AuthController.prototype.refresh).length, 0);
  assert.equal(guardsOf(AuthController.prototype.logout).length, 0);
});

test("getMe and changePassword require JwtAuthGuard", () => {
  assert.deepEqual(guardsOf(AuthController.prototype.getMe), [JwtAuthGuard]);
  assert.deepEqual(guardsOf(AuthController.prototype.changePassword), [
    JwtAuthGuard,
  ]);
});

test("POST endpoints answer 200 instead of the default 201", () => {
  for (const handler of [
    AuthController.prototype.login,
    AuthController.prototype.refresh,
    AuthController.prototype.logout,
    AuthController.prototype.changePassword,
  ]) {
    assert.equal(httpCodeOf(handler), 200);
  }
});

// ---------- Kiểm tra DTO ----------

test("LoginDto accepts valid input and strips unknown fields", async () => {
  const dto = await validate(LoginDto, {
    username: "admin",
    password: "secret",
    role: "ADMIN",
  });

  assert.equal(dto.username, "admin");
  assert.equal("role" in dto, false);
});

test("LoginDto rejects a missing password", async () => {
  await assert.rejects(
    validate(LoginDto, { username: "admin" }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("LoginDto rejects an empty username", async () => {
  await assert.rejects(
    validate(LoginDto, { username: "", password: "secret" }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("RefreshTokenDto rejects an empty refresh token", async () => {
  await assert.rejects(
    validate(RefreshTokenDto, { refreshToken: "" }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("ChangePasswordDto accepts a password of 8 to 72 characters", async () => {
  const dto = await validate(ChangePasswordDto, {
    currentPassword: "old-password",
    newPassword: "12345678",
  });

  assert.equal(dto.newPassword, "12345678");
});

test("ChangePasswordDto rejects a new password shorter than 8 characters", async () => {
  await assert.rejects(
    validate(ChangePasswordDto, {
      currentPassword: "old-password",
      newPassword: "short",
    }),
    (error: unknown) => getStatus(error) === 400,
  );
});

test("ChangePasswordDto rejects a new password longer than 72 characters", async () => {
  await assert.rejects(
    validate(ChangePasswordDto, {
      currentPassword: "old-password",
      newPassword: "a".repeat(73),
    }),
    (error: unknown) => getStatus(error) === 400,
  );
});