import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateEvaluationPeriodDto } from "./dto/create-evaluation-period.dto.js";
import type { UpdateEvaluationPeriodDto } from "./dto/update-evaluation-period.dto.js";
import type { UpsertRatingThresholdDto } from "./dto/upsert-rating-threshold.dto.js";

@Injectable()
export class EvaluationPeriodsService {
  constructor(private readonly prisma: PrismaService) { }

  findAll() {
    return this.prisma.evaluationPeriod.findMany({
      include: { ratingThresholds: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({
      where: { id },
      include: {
        ratingThresholds: true,
        criteria: { where: { parentId: null } },
      },
    });
    if (!period) {
      throw new NotFoundException(`Evaluation period ${id} was not found`);
    }
    return period;
  }

  create(createdById: string, dto: CreateEvaluationPeriodDto) {
    const now = new Date();
    return this.prisma.evaluationPeriod.create({
      data: {
        id: randomUUID(),
        year: dto.year,
        name: dto.name,
        phase: dto.phase ?? "SETUP",
        maxTotalScore: dto.maxTotalScore ?? 300,
        selfEvalStart: dto.selfEvalStart ? new Date(dto.selfEvalStart) : null,
        selfEvalDeadline: dto.selfEvalDeadline
          ? new Date(dto.selfEvalDeadline)
          : null,
        supplementHours: dto.supplementHours ?? 48,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        finalizedAt: dto.finalizedAt ? new Date(dto.finalizedAt) : null,
        createdById,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async update(id: string, dto: UpdateEvaluationPeriodDto) {
    await this.findOne(id);
    const {
      selfEvalStart,
      selfEvalDeadline,
      publishedAt,
      finalizedAt,
      ...fields
    } = dto;
    return this.prisma.evaluationPeriod.update({
      where: { id },
      data: {
        ...fields,
        ...(selfEvalStart !== undefined && {
          selfEvalStart: selfEvalStart ? new Date(selfEvalStart) : null,
        }),
        ...(selfEvalDeadline !== undefined && {
          selfEvalDeadline: selfEvalDeadline
            ? new Date(selfEvalDeadline)
            : null,
        }),
        ...(publishedAt !== undefined && {
          publishedAt: publishedAt ? new Date(publishedAt) : null,
        }),
        ...(finalizedAt !== undefined && {
          finalizedAt: finalizedAt ? new Date(finalizedAt) : null,
        }),
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { evaluations: true, reportExports: true } },
      },
    });
    if (!period) {
      throw new NotFoundException(`Evaluation period ${id} was not found`);
    }
    if (period._count.evaluations > 0) {
      throw new BadRequestException(
        "Cannot delete an evaluation period that has evaluations",
      );
    }
    if (period._count.reportExports > 0) {
      throw new BadRequestException(
        "Cannot delete an evaluation period that has report exports",
      );
    }
    return this.prisma.$transaction(async (transaction) => {
      await transaction.ratingThreshold.deleteMany({ where: { periodId: id } });
      await transaction.criterion.deleteMany({ where: { periodId: id } });
      return transaction.evaluationPeriod.delete({ where: { id } });
    });
  }

  async upsertThresholds(
    periodId: string,
    thresholds: UpsertRatingThresholdDto[],
  ) {
    await this.findOne(periodId);
    return this.prisma.$transaction(
      thresholds.map((threshold) =>
        this.prisma.ratingThreshold.upsert({
          where: { periodId_rating: { periodId, rating: threshold.rating } },
          create: {
            id: randomUUID(),
            periodId,
            rating: threshold.rating,
            label: threshold.label,
            minPercent: threshold.minPercent,
            minExclusive: threshold.minExclusive ?? false,
            color: threshold.color ?? null,
          },
          update: {
            label: threshold.label,
            minPercent: threshold.minPercent,
            minExclusive: threshold.minExclusive ?? false,
            color: threshold.color ?? null,
          },
        }),
      ),
    );
  }
}
