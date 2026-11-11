import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ERROR_CODES } from "../constants/error-codes.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { apiError } from "../utils/api-error.util.js";
import { isUUID } from "class-validator";

@Injectable()
export class AccessService {
  /** Inject tường minh để helper truy cập DB hoạt động giống nhau trên tsx và bản build ESM */
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Kiểm vai trò và đơn vị trước query, trả 404 chung để không tiết lộ hồ sơ ngoài phạm vi của UNIT */
  async assertEvaluationAccess(evaluationId: string, role: string, unitId: string | null): Promise<void> {
    if (!isUUID(evaluationId) || (role !== "ADMIN" && role !== "UNIT")
      || (role === "UNIT" && (!unitId || !isUUID(unitId)))) {
      throw new NotFoundException(apiError(404, ERROR_CODES.NOT_FOUND));
    }
    const where = role === "UNIT" && unitId
      ? { id: evaluationId, unitId }
      : { id: evaluationId };
    const evaluation = await this.prisma.evaluation.findFirst({ where, select: { id: true } });
    if (!evaluation) {
      throw new NotFoundException(apiError(404, ERROR_CODES.NOT_FOUND));
    }
  }
}
