import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "./current-user.js";

export const AUTHORIZED_ROLES = "authorizedRoles";

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(AUTHORIZED_ROLES, roles);
