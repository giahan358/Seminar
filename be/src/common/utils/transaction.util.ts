import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";

export function withTransaction<T>(prisma: PrismaService, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(work);
}

export async function lockEvaluation(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM evaluations WHERE id = ${id}::uuid FOR UPDATE`;
}

export async function lockEvaluationPeriod(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM evaluation_periods WHERE id = ${id}::uuid FOR UPDATE`;
}
