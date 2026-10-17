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

export const GetCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new Error("GetCurrentUser requires JwtAuthGuard on the route.");
    }
    return request.user;
  },
);
