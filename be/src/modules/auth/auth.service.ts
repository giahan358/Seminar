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

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900;
const REFRESH_TOKEN_EXPIRES_IN_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  randomBytes(32).toString("hex"),
  12,
);

interface LoginRequest {
  username?: unknown;
  password?: unknown;
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    code: "INVALID_CREDENTIALS",
    message: "Tên đăng nhập hoặc mật khẩu không chính xác.",
    details: [],
  });
}

function invalidLoginRequest(field: string): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message: "Dữ liệu gửi lên không hợp lệ.",
    details: [{ field, message: "Trường này là bắt buộc." }],
  });
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async login(body: LoginRequest | null | undefined) {
    if (
      !body ||
      typeof body.username !== "string" ||
      body.username.trim() === ""
    ) {
      throw invalidLoginRequest("username");
    }
    if (typeof body.password !== "string" || body.password.length === 0) {
      throw invalidLoginRequest("password");
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

    const passwordMatches = await bcrypt.compare(
      body.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      throw invalidCredentials();
    }

    if (
      !user.isActive ||
      (user.role === "UNIT" && (!user.unitId || !user.unit?.isActive)) ||
      (user.role !== "ADMIN" && user.role !== "UNIT") ||
      (user.role === "ADMIN" && user.unitId !== null)
    ) {
      throw invalidCredentials();
    }

    const now = new Date();
    const refreshToken = randomBytes(32).toString("base64url");
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_IN_MS);

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, tokenUse: "access" },
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS },
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          tokenHash: createHash("sha256").update(refreshToken).digest("hex"),
          expiresAt: refreshExpiresAt,
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
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        unitId: user.unitId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        unitId: true,
        mustChangePassword: true,
      },
    });
    if (!user) {
      throw invalidCredentials();
    }
    return user;
  }
}
