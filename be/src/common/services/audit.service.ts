import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ClockService } from "./clock.service.js";

export type AuditPayload = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ip?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService, private readonly clock: ClockService) {}

  async record(payload: AuditPayload, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        id: randomUUID(), actorId: payload.actorId, action: payload.action,
        entity: payload.entity, entityId: payload.entityId,
        before: payload.before === undefined ? Prisma.DbNull : payload.before === null ? Prisma.JsonNull : payload.before,
        after: payload.after === undefined ? Prisma.DbNull : payload.after === null ? Prisma.JsonNull : payload.after,
        ip: payload.ip ?? null, createdAt: this.clock.now(),
      },
    });
  }
}
