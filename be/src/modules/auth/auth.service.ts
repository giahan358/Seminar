import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { Prisma, User } from "../../generated/prisma/client.js";
import { AuditService } from "../../common/services/audit.service.js";

const COMMON_PASSWORDS = new Set(["123456", "1234567890", "password123", "password1234", "password12345", "qwerty12345", "qwerty123456", "admin123456", "123456789a", "123456abcd", "abcdefgh123", "abc123456789", "welcome123", "welcome1234", "iloveyou123", "matkhau123", "matkhau123456"]);
type UserWithUnit = User & { unit: { id: string; code: string; name: string; unitType: string | null; isActive: boolean } | null };
type LoginRequest = { username?: unknown; password?: unknown };
type RefreshRequest = { refreshToken?: unknown };
type ChangeRequest = { currentPassword?: unknown; newPassword?: unknown };

/** Chuyển vi phạm policy thành lỗi theo field để FE sửa đúng ô, không đưa dữ liệu mật khẩu vào phản hồi */
function validationError(field: string, message: string) {
  return new BadRequestException({ statusCode: 400, code: "VALIDATION_ERROR", message: "Dữ liệu gửi lên không hợp lệ.", details: [{ field, messages: [message] }] });
}
/** Dùng cùng lỗi cho sai mật khẩu, user vắng hoặc bị khóa nhằm tránh dò trạng thái tài khoản */
function invalidCredentials() {
  return new UnauthorizedException({ statusCode: 401, code: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không chính xác.", details: [] });
}
/** Che nguyên nhân token lạ, hết hạn hoặc tái sử dụng để không lộ trạng thái lưu trữ nội bộ */
function invalidRefreshToken() {
  return new UnauthorizedException({ statusCode: 401, code: "INVALID_REFRESH_TOKEN", message: "Phiên làm mới không hợp lệ hoặc đã hết hạn.", details: [] });
}
/** Từ chối nghiệp vụ và làm mới phiên trong khi tài khoản còn dùng mật khẩu cấp ban đầu */
export function passwordChangeRequired() {
  return new ForbiddenException({ statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "Bạn phải đổi mật khẩu trước khi sử dụng chức năng này.", details: [] });
}
/** Băm token opaque để truy vấn, chỉ giá trị băm được phép lưu trong DB */
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
/** Chọn trường công khai của chủ phiên, loại toàn bộ hash, version và thông tin liên hệ nội bộ */
function safeUser(user: User) {
  return { id: user.id, username: user.username, fullName: user.fullName, role: user.role, unitId: user.unitId, mustChangePassword: user.mustChangePassword };
}
/** Kiểm refresh ngay tại service cho cả caller nội bộ, chuỗi trống không được truy vấn DB */
function requireToken(body: RefreshRequest | null | undefined): string {
  if (typeof body?.refreshToken !== "string" || !body.refreshToken.trim()) throw validationError("refreshToken", "Mã làm mới phiên là bắt buộc.");
  return body.refreshToken;
}

@Injectable()
export class AuthService {
  private readonly dummyHash: string;
  /** Inject tường minh để tsx và ESM cùng dùng Prisma, JWT, cấu hình đã validate và audit thật */
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService) {
    // Dùng cùng cost được cấu hình cho credential mới để user không tồn tại cũng chịu phép so bcrypt tương ứng
    this.dummyHash = bcrypt.hashSync(randomBytes(32).toString("hex"), this.config.get<number>("BCRYPT_COST", 12));
  }

  /** Chỉ chấp nhận ADMIN không có đơn vị hoặc UNIT thuộc đơn vị hoạt động, không tin role do client gửi */
  private usable(user: UserWithUnit | null): user is UserWithUnit {
    return Boolean(user?.isActive && ((user.role === "ADMIN" && !user.unitId) || (user.role === "UNIT" && user.unitId && user.unit?.isActive)));
  }
  /** Khóa hàng user trước mọi thay đổi credential và refresh để request cạnh tranh tuần tự cùng một chủ phiên */
  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.user.findUnique({ where: { id }, include: { unit: true } });
  }
  /** Tạo cặp token trong transaction đang giữ khóa user, chỉ trả token thô sau commit và không sửa lastLoginAt */
  private async issue(tx: Prisma.TransactionClient, user: User) {
    const expiresIn = this.config.get<number>("JWT_ACCESS_TTL", 900);
    const refreshToken = randomBytes(48).toString("base64url");
    const now = new Date();
    const accessToken = await this.jwt.signAsync({ sub: user.id, tokenUse: "access", ver: user.credentialVersion }, {
      algorithm: "HS256", issuer: this.config.get<string>("JWT_ISSUER", "seminar-api"),
      audience: this.config.get<string>("JWT_AUDIENCE", "seminar-web"), expiresIn, jwtid: randomUUID(),
    });
    await tx.refreshToken.create({ data: { id: randomUUID(), userId: user.id, tokenHash: tokenHash(refreshToken),
      expiresAt: new Date(now.getTime() + this.config.get<number>("JWT_REFRESH_TTL", 604800) * 1000), createdAt: now } });
    return { accessToken, refreshToken, tokenType: "Bearer", expiresIn, user: safeUser(user) };
  }
  /** Xác thực bằng bcrypt kể cả user lạ, kiểm lại sau khóa để đổi mật khẩu cạnh tranh không cấp phiên theo hash cũ */
  async login(body: LoginRequest | null | undefined, ip: string | null = null) {
    if (typeof body?.username !== "string" || body.username.trim().length < 3 || body.username.trim().length > 64) throw validationError("username", "Tên đăng nhập phải có từ 3 đến 64 ký tự.");
    if (typeof body.password !== "string" || !body.password.length || body.password.length > 128) throw validationError("password", "Mật khẩu phải có từ 1 đến 128 ký tự.");
    const found = await this.prisma.user.findUnique({ where: { username: body.username.trim() }, include: { unit: true } });
    const matches = await bcrypt.compare(body.password, found?.passwordHash ?? this.dummyHash);
    const result = !found || !matches ? null : await this.prisma.$transaction(async (tx) => {
      const user = await this.lock(tx, found.id);
      if (!this.usable(user) || user.passwordHash !== found.passwordHash) return null;
      const now = new Date();
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now, updatedAt: now } });
      const pair = await this.issue(tx, user);
      await this.audit.record({ actorId: user.id, action: "LOGIN_SUCCESS", entity: "User", entityId: user.id, ip }, tx);
      return pair;
    });
    if (!result) {
      await this.audit.record({ actorId: found?.id ?? null, action: "LOGIN_FAILED", entity: "User", entityId: found?.id ?? "unknown", ip });
      throw invalidCredentials();
    }
    return result;
  }
  /** Trả projection hồ sơ và đơn vị hiện hành sau kiểm trạng thái, ADMIN không có đơn vị nhận null */
  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { unit: true } });
    if (!this.usable(user)) throw invalidCredentials();
    return { ...safeUser(user), unit: user.unit ? { id: user.unit.id, code: user.unit.code, name: user.unit.name, unitType: user.unit.unitType } : null };
  }
  /** Xoay refresh dưới khóa user, tái đọc token sau khóa để reuse cạnh tranh cũng thu hồi phiên vừa cấp */
  async refresh(body: RefreshRequest | null | undefined) {
    const hash = tokenHash(requireToken(body));
    const owner = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!owner) throw invalidRefreshToken();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const user = await this.lock(tx, owner.userId);
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash: hash } });
      const now = new Date();
      // Không ném trong transaction reuse vì rollback sẽ phục hồi các refresh cần thu hồi
      if (stored?.revokedAt) {
        await tx.refreshToken.updateMany({ where: { userId: owner.userId, revokedAt: null }, data: { revokedAt: now } });
        return { kind: "invalid" } as const;
      }
      if (!stored || stored.expiresAt <= now || !this.usable(user)) return { kind: "invalid" } as const;
      if (user.mustChangePassword) return { kind: "password" } as const;
      const revoked = await tx.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now } });
      if (revoked.count !== 1) {
        await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
        return { kind: "invalid" } as const;
      }
      return { kind: "ok", pair: await this.issue(tx, user) } as const;
    });
    if (outcome.kind === "password") throw passwordChangeRequired();
    if (outcome.kind !== "ok") throw invalidRefreshToken();
    return outcome.pair;
  }
  /** Chỉ thu hồi token được gửi, lặp lại hoặc token không tồn tại vẫn thành công và không ảnh hưởng phiên khác */
  async logout(body: RefreshRequest | null | undefined) {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: tokenHash(requireToken(body)), revokedAt: null }, data: { revokedAt: new Date() } });
    return { success: true };
  }
  /** Đổi mật khẩu chính chủ dưới khóa user, tăng version và cấp phiên mới nguyên tử để access cũ mất hiệu lực ngay */
  async changePassword(currentUser: { id: string; role?: string; unitId?: string | null }, body: ChangeRequest | null | undefined, ip: string | null = null) {
    if (typeof body?.currentPassword !== "string" || !body.currentPassword) throw validationError("currentPassword", "Mật khẩu hiện tại là bắt buộc.");
    if (typeof body.newPassword !== "string" || Array.from(body.newPassword).length < 10 || !/\p{L}/u.test(body.newPassword) || !/[0-9]/.test(body.newPassword)) throw validationError("newPassword", "Mật khẩu mới phải có ít nhất 10 ký tự, gồm chữ và số.");
    const next = body.newPassword;
    if (Buffer.byteLength(next, "utf8") > 72) throw validationError("newPassword", "Mật khẩu mới không được vượt quá 72 byte UTF-8.");
    if (COMMON_PASSWORDS.has(next.toLowerCase()) || next === this.config.get<string>("INITIAL_ACCOUNT_PASSWORD", "123456")) throw validationError("newPassword", "Mật khẩu mới quá phổ biến, vui lòng chọn mật khẩu khác.");
    const current = body.currentPassword;
    return this.prisma.$transaction(async (tx) => {
      const user = await this.lock(tx, currentUser.id);
      if (!this.usable(user)) throw invalidCredentials();
      if (!await bcrypt.compare(current, user.passwordHash)) throw validationError("currentPassword", "Mật khẩu hiện tại không chính xác.");
      if (next.toLowerCase() === user.username.toLowerCase() || await bcrypt.compare(next, user.passwordHash)) throw validationError("newPassword", "Mật khẩu mới phải khác tên đăng nhập và mật khẩu hiện tại.");
      const now = new Date();
      const updated = await tx.user.update({ where: { id: user.id }, data: {
        passwordHash: await bcrypt.hash(next, this.config.get<number>("BCRYPT_COST", 12)), mustChangePassword: false,
        credentialVersion: { increment: 1 }, passwordChangedAt: now, updatedAt: now,
      } });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      const pair = await this.issue(tx, updated);
      await this.audit.record({ actorId: user.id, action: "PASSWORD_CHANGED", entity: "User", entityId: user.id, ip }, tx);
      return pair;
    });
  }
}
