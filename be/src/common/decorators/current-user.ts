import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type UserRole = "ADMIN" | "UNIT";

export interface CurrentUser {
  id: string;
  role: UserRole;
  unitId: string | null;
}

interface AuthenticatedRequest {
  user?: CurrentUser;
}

/** Lấy danh tính đã được JWT guard xác thực từ request, lỗi cấu hình route thiếu guard phải dùng câu tiếng Việt */
export const GetCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new Error("Route lấy người dùng hiện tại phải có guard xác thực.");
    }
    return request.user;
  },
);
