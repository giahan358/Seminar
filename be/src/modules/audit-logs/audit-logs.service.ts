import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateAuditLogDto } from "./dto/create-audit-log.dto.js";
import type { QueryAuditLogDto } from "./dto/query-audit-log.dto.js";
import { ERROR_CODES } from "../../common/constants/error-codes.js";
import { AuditService } from "../../common/services/audit.service.js";

@Injectable()
export class AuditLogsService {
  /** Inject dependency tường minh theo mẫu Auth để cùng luồng DB hoạt động trên tsx và bản build ESM */
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: QueryAuditLogDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity && { entity: query.entity }),
      ...(query.action && { action: query.action }),
      ...(query.actorId && { actorId: query.actorId }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: { select: { id: true, fullName: true, username: true } },
      },
    });
    if (!auditLog) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: "Không tìm thấy nhật ký hoạt động" });
    }
    return auditLog;
  }

  record(data: CreateAuditLogDto) {
    return this.audit.record({ ...data, actorId: data.actorId ?? null });
  }
}
