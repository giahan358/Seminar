import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  SetMetadata,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CurrentUser, UserRole } from "../decorators/current-user.js";
import { AUTHORIZED_ROLES } from "../decorators/roles.decorator.js";
import { ERROR_CODES } from "../constants/error-codes.js";

/** Chỉ đánh dấu handler Auth cho phép truy cập khi còn cờ, không suy luận whitelist từ URL */
export const AllowPasswordChange = () => SetMetadata("auth:allow-password-change", true);

interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: CurrentUser;
}

interface AccessTokenPayload {
  sub?: unknown;
  ver?: unknown;
  exp?: unknown;
  tokenUse?: unknown;
}

function unauthorized(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    code: ERROR_CODES.UNAUTHORIZED,
    message: "Đăng nhập hoặc access token hợp lệ là bắt buộc.",

  });
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  /** Inject hai nguồn xác thực tường minh, giữ hoạt động như nhau trên tsx và bản build ESM */
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** Kiểm JWT rồi trạng thái DB/version trước policy đổi mật khẩu, trả CurrentUser trước khi RolesGuard thực thi */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const [scheme, token, extra] = authorization?.trim().split(/\s+/) ?? [];

    if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
      throw unauthorized();
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, { algorithms: ["HS256"] });
    } catch {
      throw unauthorized();
    }

    if (
      typeof payload.sub !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub) ||
      !Number.isInteger(payload.ver) || typeof payload.exp !== "number" || payload.exp <= Date.now() / 1000 ||
      payload.tokenUse !== "access"
    ) {
      throw unauthorized();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        unitId: true,
        isActive: true,
        credentialVersion: true,
        mustChangePassword: true,
        unit: { select: { isActive: true } },
      },
    });

    if (!user?.isActive || user.credentialVersion !== payload.ver) {
      throw unauthorized();
    }

    // Metadata chỉ được gắn trên me/change-password, mọi route nghiệp vụ bị chặn trước khi kiểm role
    if (user.mustChangePassword && !Reflect.getMetadata("auth:allow-password-change", context.getHandler())) {
      throw new ForbiddenException({ statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "Bạn phải đổi mật khẩu trước khi sử dụng chức năng này.", details: [] });
    }

    if (user.role === "ADMIN" && user.unitId === null) {
      request.user = { id: user.id, role: "ADMIN", unitId: null };
      return true;
    }

    if (
      user.role === "UNIT" &&
      user.unitId !== null &&
      user.unit?.isActive
    ) {
      request.user = { id: user.id, role: "UNIT", unitId: user.unitId };
      return true;
    }

    throw unauthorized();
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      AUTHORIZED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user && requiredRoles.includes(request.user.role)) {
      return true;
    }

    throw new ForbiddenException({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Bạn không có quyền thực hiện thao tác này.",

    });
  }
}
