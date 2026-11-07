import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ERROR_CODES } from "../../common/constants/error-codes.js";

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900;
const REFRESH_TOKEN_EXPIRES_IN_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
const MAX_PASSWORD_LENGTH = 72;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  randomBytes(32).toString("hex"),
  BCRYPT_ROUNDS,
);

interface LoginRequest {
  username?: unknown;
  password?: unknown;
}

interface RefreshRequest {
  refreshToken?: unknown;
}

interface ChangePasswordRequest {
  currentPassword?: unknown;
  newPassword?: unknown;
}

interface AuthenticatedUser {
  id: string;
  role: "ADMIN" | "UNIT";
  unitId: string | null;
}

interface SafeUserSource {
  id: string;
  username: string;
  fullName: string;
  role: string;
  unitId: string | null;
  mustChangePassword: boolean;
}

function validationError(
  field: string,
  message = "Trường này không hợp lệ.",
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: "Dữ liệu gửi lên không hợp lệ.",
    details: [{ field, messages: [message] }],
  });
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    code: ERROR_CODES.UNAUTHORIZED,
    message: "Tên đăng nhập hoặc mật khẩu không chính xác.",
  });
}

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    code: "INVALID_REFRESH_TOKEN",
    message: "Refresh token không hợp lệ hoặc đã hết hạn.",
    details: [],
  });
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toSafeUser(user: SafeUserSource) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    unitId: user.unitId,
    mustChangePassword: user.mustChangePassword,
  };
}

function requireRefreshToken(body: RefreshRequest | null | undefined): string {
  if (
    !body ||
    typeof body.refreshToken !== "string" ||
    body.refreshToken.trim() === ""
  ) {
    throw validationError("refreshToken", "Refresh token là bắt buộc.");
  }
  return body.refreshToken;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  private isUsable(user: {
    role: string;
    unitId: string | null;
    isActive: boolean;
    unit?: { isActive: boolean } | null;
  }): boolean {
    if (!user.isActive) return false;
    if (user.role === "ADMIN") return user.unitId === null;
    if (user.role === "UNIT") return Boolean(user.unitId && user.unit?.isActive);
    return false;
  }

  private async findValidUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        unitId: true,
        isActive: true,
        mustChangePassword: true,
        unit: {
          select: { id: true, code: true, name: true, unitType: true, isActive: true },
        },
      },
    });

    return user && this.isUsable(user) ? user : null;
  }

  private signAccessToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, tokenUse: "access" },
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS },
    );
  }

  private async createTokenPair(user: SafeUserSource) {
    const now = new Date();
    const refreshToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_IN_MS);
    const accessToken = await this.signAccessToken(user.id);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt,
          createdAt: now,
        },
      });

      await transaction.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now, updatedAt: now },
      });
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      user: toSafeUser(user),
    };
  }

  async login(body: LoginRequest | null | undefined) {
    if (
      !body ||
      typeof body.username !== "string" ||
      body.username.trim() === ""
    ) {
      throw validationError("username", "Tên đăng nhập là bắt buộc.");
    }

    if (typeof body.password !== "string" || body.password.length === 0) {
      throw validationError("password", "Mật khẩu là bắt buộc.");
    }

    const user = await this.prisma.user.findUnique({
      where: { username: body.username.trim() },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        fullName: true,
        role: true,
        unitId: true,
        isActive: true,
        mustChangePassword: true,
        unit: { select: { isActive: true } },
      },
    });

    // Luôn chạy bcrypt (kể cả khi không có user) để chống dò tên đăng nhập qua thời gian phản hồi.
    const passwordMatches = await bcrypt.compare(
      body.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches || !this.isUsable(user)) {
      throw invalidCredentials();
    }

    return this.createTokenPair(user);
  }

  async getMe(userId: string) {
    const user = await this.findValidUser(userId);
    if (!user) throw invalidCredentials();

    // Docx: /auth/me trả hồ sơ người dùng kèm đơn vị tương ứng (ADMIN thì unit = null).
    return {
      ...toSafeUser(user),
      unit: user.unit
        ? {
            id: user.unit.id,
            code: user.unit.code,
            name: user.unit.name,
            unitType: user.unit.unitType,
          }
        : null,
    };
  }

  async refresh(body: RefreshRequest | null | undefined) {
    const refreshToken = requireRefreshToken(body);
    const now = new Date();

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt !== null ||
      storedToken.expiresAt <= now
    ) {
      throw invalidRefreshToken();
    }

    const user = await this.findValidUser(storedToken.userId);
    if (!user) throw invalidRefreshToken();

    const newRefreshToken = randomBytes(32).toString("base64url");
    const newExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_IN_MS);
    const accessToken = await this.signAccessToken(user.id);

    // Xoay vòng: thu hồi token cũ + tạo token mới trong cùng transaction.
    // updateMany có điều kiện revokedAt = null để 2 request song song không cùng dùng 1 token.
    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revoked.count !== 1) {
        throw invalidRefreshToken();
      }

      await transaction.refreshToken.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          tokenHash: hashRefreshToken(newRefreshToken),
          expiresAt: newExpiresAt,
          createdAt: now,
        },
      });
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      user: toSafeUser(user),
    };
  }

  async logout(body: RefreshRequest | null | undefined) {
    const refreshToken = requireRefreshToken(body);

    // Idempotent: token lạ hoặc đã thu hồi vẫn trả success.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async changePassword(
    currentUser: AuthenticatedUser,
    body: ChangePasswordRequest | null | undefined,
  ) {
    if (
      !body ||
      typeof body.currentPassword !== "string" ||
      body.currentPassword.length === 0
    ) {
      throw validationError("currentPassword", "Mật khẩu hiện tại là bắt buộc.");
    }

    if (typeof body.newPassword !== "string" || body.newPassword.length < 8) {
      throw validationError(
        "newPassword",
        "Mật khẩu mới phải có ít nhất 8 ký tự.",
      );
    }

    if (body.newPassword.length > MAX_PASSWORD_LENGTH) {
      throw validationError(
        "newPassword",
        `Mật khẩu mới không được quá ${MAX_PASSWORD_LENGTH} ký tự.`,
      );
    }

    if (body.currentPassword === body.newPassword) {
      throw validationError(
        "newPassword",
        "Mật khẩu mới phải khác mật khẩu hiện tại.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw invalidCredentials();
    }

    const matches = await bcrypt.compare(body.currentPassword, user.passwordHash);

    if (!matches) {
      // Dùng 400 (không phải 401) để FE không nhầm là token hết hạn rồi tự đăng xuất.
      throw validationError(
        "currentPassword",
        "Mật khẩu hiện tại không chính xác.",
      );
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: now,
          updatedAt: now,
        },
      });

      await transaction.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    return this.getMe(user.id);
  }
}