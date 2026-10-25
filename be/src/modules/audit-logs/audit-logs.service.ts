import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateAuditLogDto } from "./dto/create-audit-log.dto.js";
import type { QueryAuditLogDto } from "./dto/query-audit-log.dto.js";

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotFoundException(`Audit log ${id} was not found`);
    }
    return auditLog;
  }

  logAction(data: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: data.actorId ?? null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        before:
          data.before === undefined
            ? Prisma.DbNull
            : data.before === null
              ? Prisma.JsonNull
              : data.before,
        after:
          data.after === undefined
            ? Prisma.DbNull
            : data.after === null
              ? Prisma.JsonNull
              : data.after,
        ip: data.ip ?? null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      },
    });
  }
}
