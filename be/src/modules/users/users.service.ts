import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ERROR_CODES } from "../../common/constants/error-codes.js";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import type { CreateUserDto } from "./dto/create-user.dto.js";
import type { UpdateUserDto } from "./dto/update-user.dto.js";

const BCRYPT_ROUNDS = 12;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  unitId: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function badRequest(field: string, message: string) {
  return new BadRequestException({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message: "Dữ liệu gửi lên không hợp lệ.",
    details: [{ field, messages: [message] }],
  });
}

function userNotFound() {
  return new NotFoundException({
    statusCode: 404,
    code: "USER_NOT_FOUND",
    message: "Không tìm thấy tài khoản.",
    details: [],
  });
}

function unitAccountExists() {
  return new ConflictException({
    statusCode: 409,
    code: "UNIT_ACCOUNT_EXISTS",
    message: "Đơn vị đã có tài khoản UNIT.",
    details: [],
  });
}

function userAlreadyExists() {
  return new ConflictException({
    statusCode: 409,
    code: ERROR_CODES.CONFLICT,
    message: "Username, email hoặc đơn vị đã được sử dụng.",
    details: [],
  });
}

function usernameTaken() {
  return new ConflictException({
    statusCode: 409,
    code: ERROR_CODES.USERNAME_TAKEN,
    message: "Tên đăng nhập đã được sử dụng.",
    details: [],
  });
}

function emailTaken() {
  return new ConflictException({
    statusCode: 409,
    code: ERROR_CODES.CONFLICT,
    message: "Email đã được sử dụng.",
    details: [],
  });
}

function selfModification() {
  return new UnprocessableEntityException({
    statusCode: 422,
    code: ERROR_CODES.BUSINESS_RULE_VIOLATION,
    message: "Không thể tự khóa tài khoản hoặc tự hạ quyền chính mình.",
    details: [],
  });
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function parsePagination(pageValue?: string, sizeValue?: string) {
  const page = pageValue === undefined ? 1 : Number(pageValue);
  const pageSize = sizeValue === undefined ? 20 : Number(sizeValue);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw badRequest("pagination", "page phải từ 1; pageSize từ 1 đến 100.");
  }

  return { page, pageSize };
}

// Chỉ tính field client thật sự gửi (DTO có thể mang key với giá trị undefined).
function suppliedKeys(dto: object): string[] {
  return Object.entries(dto)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async findAll(query: {
    page?: string;
    pageSize?: string;
    role?: string;
    unitId?: string;
    isActive?: string;
  }) {
    const { page, pageSize } = parsePagination(query.page, query.pageSize);

    if (query.role && !["ADMIN", "UNIT"].includes(query.role)) {
      throw badRequest("role", "Role chỉ được là ADMIN hoặc UNIT.");
    }

    // Truyền chuỗi không phải UUID vào cột uuid sẽ làm Prisma báo lỗi 500.
    if (query.unitId && !UUID_PATTERN.test(query.unitId)) {
      throw badRequest("unitId", "unitId phải là UUID hợp lệ.");
    }

    let isActive: boolean | undefined;
    if (query.isActive !== undefined) {
      if (!["true", "false"].includes(query.isActive)) {
        throw badRequest("isActive", "isActive chỉ được là true hoặc false.");
      }
      isActive = query.isActive === "true";
    }

    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          ...USER_SELECT,
          unit: {
            select: { id: true, code: true, name: true, unitType: true },
          },
        },
      }),
    ]);

    return { items, page, pageSize, total };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    if (currentUser.role !== "ADMIN" && currentUser.id !== id) {
      throw userNotFound();
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        unit: {
          select: {
            id: true,
            code: true,
            name: true,
            unitType: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) throw userNotFound();
    return user;
  }

  async create(dto: CreateUserDto) {
    const username = dto.username?.trim();
    const fullName = dto.fullName?.trim();

    if (!username) throw badRequest("username", "username là bắt buộc.");
    if (!fullName) throw badRequest("fullName", "fullName là bắt buộc.");
    if (!["ADMIN", "UNIT"].includes(dto.role)) {
      throw badRequest("role", "Role chỉ được là ADMIN hoặc UNIT.");
    }

    if (dto.role === "ADMIN" && dto.unitId) {
      throw badRequest("unitId", "Tài khoản ADMIN không được gắn đơn vị.");
    }

    const unitId = dto.role === "ADMIN" ? null : (dto.unitId ?? null);

    if (dto.role === "UNIT" && !unitId) {
      throw badRequest("unitId", "Tài khoản UNIT phải có unitId.");
    }

    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, isActive: true },
      });

      if (!unit || !unit.isActive) {
        throw badRequest("unitId", "Đơn vị không tồn tại hoặc đang bị khóa.");
      }

      const assignedUser = await this.prisma.user.findFirst({
        where: { unitId },
        select: { id: true },
      });

      if (assignedUser) throw unitAccountExists();
    }

    // Kiểm tra trước để trả mã lỗi rõ ràng (P2002 với driver adapter có thể không kèm tên cột).
    const sameUsername = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (sameUsername) throw usernameTaken();

    const email = dto.email?.trim() || null;
    if (email) {
      const sameEmail = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (sameEmail) throw emailTaken();
    }

    const temporaryPassword = randomBytes(12).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const now = new Date();

    try {
      const user = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          username,
          passwordHash,
          mustChangePassword: true,
          fullName,
          email,
          phone: dto.phone?.trim() || null,
          role: dto.role,
          unitId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        select: USER_SELECT,
      });

      // Mật khẩu tạm chỉ hiển thị đúng một lần, không lưu dạng rõ.
      return { ...user, temporaryPassword };
    } catch (error) {
      if (isUniqueError(error)) throw userAlreadyExists();
      throw error;
    }
  }

  async update(id: string, currentUser: CurrentUser, dto: UpdateUserDto) {
    const isAdmin = currentUser.role === "ADMIN";

    if (!isAdmin && currentUser.id !== id) throw userNotFound();

    const allowedFields = isAdmin
      ? ["fullName", "email", "phone", "role", "unitId"]
      : ["fullName", "email", "phone"];

    const supplied = suppliedKeys(dto);

    if (
      !isAdmin &&
      supplied.some((field) => ["role", "unitId", "isActive"].includes(field))
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "FORBIDDEN",
        message: "Bạn không được tự thay đổi quyền hoặc đơn vị",
        details: [],
      });
    }

    if (
      supplied.length === 0 ||
      supplied.some((field) => !allowedFields.includes(field))
    ) {
      throw badRequest("body", "Không có dữ liệu hợp lệ để cập nhật.");
    }

    if (dto.fullName !== undefined && !dto.fullName.trim()) {
      throw badRequest("fullName", "fullName không được để trống.");
    }

    // Admin không được tự khóa / hạ quyền / chuyển đơn vị cho chính mình (tránh mất quyền quản trị).
    if (
      isAdmin &&
      currentUser.id === id &&
      ((dto.role !== undefined && dto.role !== "ADMIN") || dto.unitId)
    ) {
      throw selfModification();
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, unitId: true },
    });

    if (!existing) throw userNotFound();

    const data: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      role?: string;
      unitId?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.email !== undefined) {
      const email = dto.email?.trim() || null;
      if (email) {
        const sameEmail = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (sameEmail && sameEmail.id !== id) throw emailTaken();
      }
      data.email = email;
    }
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;

    if (isAdmin) {
      // Chỉ kiểm tra role/đơn vị khi admin thật sự đổi chúng,
      // để sửa tên/email của user thuộc đơn vị đang khóa vẫn được.
      if (dto.role !== undefined || dto.unitId !== undefined) {
        const nextRole = dto.role ?? existing.role;
        let nextUnitId =
          dto.unitId !== undefined ? dto.unitId : existing.unitId;

        if (nextRole === "ADMIN") {
          if (dto.unitId) {
            throw badRequest("unitId", "Tài khoản ADMIN không được gắn đơn vị.");
          }
          nextUnitId = null;
        } else if (nextRole === "UNIT") {
          if (!nextUnitId) {
            throw badRequest("unitId", "Tài khoản UNIT phải có unitId.");
          }

          const unit = await this.prisma.unit.findUnique({
            where: { id: nextUnitId },
            select: { id: true, isActive: true },
          });

          if (!unit || !unit.isActive) {
            throw badRequest("unitId", "Đơn vị không tồn tại hoặc đang bị khóa.");
          }

          const assigned = await this.prisma.user.findFirst({
            where: { unitId: nextUnitId, NOT: { id } },
            select: { id: true },
          });

          if (assigned) throw unitAccountExists();
        } else {
          throw badRequest("role", "Role chỉ được là ADMIN hoặc UNIT.");
        }

        data.role = nextRole;
        data.unitId = nextUnitId;
      }
    }

    // Khóa/mở tài khoản chỉ đi qua PATCH /users/:id/status (có thu hồi token và chặn tự khóa).
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: USER_SELECT,
      });
    } catch (error) {
      if (isUniqueError(error)) throw userAlreadyExists();
      throw error;
    }
  }

  async resetPassword(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) throw userNotFound();

    const temporaryPassword = randomBytes(12).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: now,
          updatedAt: now,
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    return { userId: id, temporaryPassword, mustChangePassword: true };
  }

  async updateStatus(id: string, isActive: boolean, currentUser: CurrentUser) {
    if (typeof isActive !== "boolean") {
      throw badRequest("isActive", "isActive phải là true hoặc false.");
    }

    if (currentUser.id === id && !isActive) throw selfModification();

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) throw userNotFound();

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive, updatedAt: now },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          unitId: true,
          isActive: true,
          updatedAt: true,
        },
      });

      if (!isActive) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      return updated;
    });
  }
}