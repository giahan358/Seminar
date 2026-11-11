import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ClockService } from "./clock.service.js";
import { redactSecrets } from "../utils/redact-secrets.util.js";

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
  /** Inject dependency tường minh theo mẫu Auth để cùng luồng DB hoạt động trên tsx và bản build ESM */
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(ClockService) private readonly clock: ClockService) {}

  /** Ghi audit cùng transaction nếu có, che credential trong before/after và phân biệt SQL NULL với JSON null */
  async record(payload: AuditPayload, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        id: randomUUID(), actorId: payload.actorId, action: payload.action,
        entity: payload.entity, entityId: payload.entityId,
        before: payload.before === undefined ? Prisma.DbNull : payload.before === null ? Prisma.JsonNull : redactSecrets(payload.before) as Prisma.InputJsonValue,
        after: payload.after === undefined ? Prisma.DbNull : payload.after === null ? Prisma.JsonNull : redactSecrets(payload.after) as Prisma.InputJsonValue,
        ip: payload.ip ?? null, createdAt: this.clock.now(),
      },
    });
  }
}
