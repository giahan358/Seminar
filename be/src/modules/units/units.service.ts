import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ERROR_CODES } from "../../common/constants/error-codes.js";
import { UNIT_TYPES, UNIT_TYPE_MESSAGE } from "./unit-types.js";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import type { CreateUnitDto } from "./dto/create-unit.dto.js";
import type { UpdateUnitDto } from "./dto/update-unit.dto.js";

const UNIT_SELECT = {
  id: true,
  code: true,
  name: true,
  unitType: true,
  sortOrder: true,
  isActive: true,
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

function notFound() {
  return new NotFoundException({
    statusCode: 404,
    code: "UNIT_NOT_FOUND",
    message: "Không tìm thấy đơn vị.",
    details: [],
  });
}

function codeTaken() {
  return new ConflictException({
    statusCode: 409,
    code: ERROR_CODES.UNIT_CODE_TAKEN,
    message: "Mã đơn vị đã tồn tại.",
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

// DB có CHECK cho unit_type nhưng vi phạm sẽ thành lỗi 500; kiểm tra trước để trả 400 rõ ràng.
function assertUnitType(value: string | null | undefined): void {
  if (value === undefined || value === null) return;
  if (!(UNIT_TYPES as readonly string[]).includes(value)) {
    throw badRequest("unitType", UNIT_TYPE_MESSAGE);
  }
}

// Class có field khai báo (useDefineForClassFields) có thể mang key = undefined,
// nên chỉ tính những field thật sự được client gửi.
function suppliedKeys(dto: object): string[] {
  return Object.entries(dto)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}

@Injectable()
export class UnitsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async findAll(
    currentUser: CurrentUser,
    query: {
      page?: string;
      pageSize?: string;
      unitType?: string;
      isActive?: string;
    },
  ) {
    if (currentUser.role === "UNIT") {
      if (!currentUser.unitId) throw notFound();
      const unit = await this.prisma.unit.findUnique({
        where: { id: currentUser.unitId },
        select: UNIT_SELECT,
      });
      if (!unit) throw notFound();
      return { items: [unit], page: 1, pageSize: 1, total: 1 };
    }

    const { page, pageSize } = parsePagination(query.page, query.pageSize);
    assertUnitType(query.unitType || undefined);

    let isActive: boolean | undefined;
    if (query.isActive !== undefined) {
      if (!["true", "false"].includes(query.isActive)) {
        throw badRequest("isActive", "isActive chỉ được là true hoặc false.");
      }
      isActive = query.isActive === "true";
    }

    const where = {
      ...(query.unitType ? { unitType: query.unitType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.unit.count({ where }),
      this.prisma.unit.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: UNIT_SELECT,
      }),
    ]);

    return { items, page, pageSize, total };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    // 404 thay vì 403 để không lộ sự tồn tại của đơn vị khác.
    if (currentUser.role === "UNIT" && currentUser.unitId !== id) {
      throw notFound();
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: UNIT_SELECT,
    });

    if (!unit) throw notFound();
    return unit;
  }

  async create(dto: CreateUnitDto) {
    const code = dto.code?.trim();
    const name = dto.name?.trim();

    if (!code) throw badRequest("code", "code là bắt buộc.");
    if (!name) throw badRequest("name", "name là bắt buộc.");

    if (
      dto.sortOrder !== undefined &&
      (!Number.isInteger(dto.sortOrder) || dto.sortOrder < 0)
    ) {
      throw badRequest("sortOrder", "sortOrder phải là số nguyên không âm.");
    }

    const duplicate = await this.prisma.unit.findUnique({
      where: { code },
      select: { id: true },
    });
    if (duplicate) throw codeTaken();

    const unitType = dto.unitType?.trim() || null;
    assertUnitType(unitType);

    const now = new Date();

    try {
      return await this.prisma.unit.create({
        data: {
          id: randomUUID(),
          code,
          name,
          unitType,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        },
        select: UNIT_SELECT,
      });
    } catch (error) {
      if (isUniqueError(error)) throw codeTaken();
      throw error;
    }
  }

  async update(id: string, dto: UpdateUnitDto) {
    const allowedFields = ["code", "name", "unitType", "sortOrder", "isActive"];
    const fields = suppliedKeys(dto);

    if (
      fields.length === 0 ||
      fields.some((field) => !allowedFields.includes(field))
    ) {
      throw badRequest("body", "Không có dữ liệu hợp lệ để cập nhật.");
    }

    if (dto.code !== undefined && !dto.code.trim()) {
      throw badRequest("code", "code không được để trống.");
    }
    if (dto.name !== undefined && !dto.name.trim()) {
      throw badRequest("name", "name không được để trống.");
    }
    if (
      dto.sortOrder !== undefined &&
      (!Number.isInteger(dto.sortOrder) || dto.sortOrder < 0)
    ) {
      throw badRequest("sortOrder", "sortOrder phải là số nguyên không âm.");
    }

    const existing = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw notFound();

    if (dto.code !== undefined) {
      const duplicate = await this.prisma.unit.findUnique({
        where: { code: dto.code.trim() },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id) throw codeTaken();
    }

    const data: {
      code?: string;
      name?: string;
      unitType?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.unitType !== undefined) {
      const unitType = dto.unitType?.trim() || null;
      assertUnitType(unitType);
      data.unitType = unitType;
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      return await this.prisma.unit.update({
        where: { id },
        data,
        select: UNIT_SELECT,
      });
    } catch (error) {
      if (isUniqueError(error)) throw codeTaken();
      throw error;
    }
  }

  async findUsers(id: string, currentUser: CurrentUser) {
    if (currentUser.role === "UNIT" && currentUser.unitId !== id) {
      throw notFound();
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!unit) throw notFound();

    const items = await this.prisma.user.findMany({
      where: { unitId: id },
      orderBy: { createdAt: "asc" },
      select: {
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
      },
    });

    return { items, total: items.length };
  }
}