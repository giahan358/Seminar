import { Injectable, NotFoundException } from "@nestjs/common";
import { ERROR_CODES } from "../constants/error-codes.js";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertEvaluationAccess(evaluationId: string, role: string, unitId: string | null): Promise<void> {
    const where = role === "UNIT" && unitId
      ? { id: evaluationId, unitId }
      : role === "UNIT"
        ? { id: evaluationId, unitId: "__khong-co-don-vi__" }
        : { id: evaluationId };
    const evaluation = await this.prisma.evaluation.findFirst({ where, select: { id: true } });
    if (!evaluation) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: "Không tìm thấy hồ sơ" });
    }
  }
}
