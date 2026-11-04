import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ERROR_CODES } from "../../common/constants/error-codes.js";
import { decimal, toApiNumber } from "../../common/utils/decimal.util.js";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  DashboardPeriodDto,
  EvaluationStatusCountsDto,
  ScoreDistributionDto,
  ScoreDistributionItemDto,
} from "./dto/dashboard-overview.dto.js";

const EVALUATION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "SUPPLEMENT_REQUESTED",
  "SUPPLEMENT_SUBMITTED",
  "SUPPLEMENT_EXPIRED",
  "FINALIZED",
] as const;

type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

type DeductionAggregate = {
  criterionId: string;
  code: string;
  name: string;
  sortOrder: number;
  unitsDeducted: number;
  totalPointsDeducted: Prisma.Decimal;
};

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getOverview(periodId: string) {
    const period = await this.findPeriodOrThrow(periodId);
    const [statusGroups, officialResults, scoreDistribution] = await Promise.all([
      this.prisma.evaluation.groupBy({
        by: ["status"],
        where: { periodId },
        _count: { _all: true },
      }),
      this.prisma.evaluation.aggregate({
        where: { periodId, status: "FINALIZED" },
        _count: { _all: true },
        _sum: { finalScore: true },
        _avg: { finalScore: true, finalPercent: true },
      }),
      this.getScoreDistributionForPeriod(periodId),
    ]);
    const statusCounts = this.createStatusCounts(statusGroups);
    const totalUnits = this.sumStatusCounts(statusCounts);
    const finalizedCount = officialResults._count._all;
    const submittedCount = totalUnits - statusCounts.DRAFT;
    const supplementPendingCount =
      statusCounts.SUPPLEMENT_REQUESTED + statusCounts.SUPPLEMENT_SUBMITTED;

    return {
      periodId,
      period: this.toPeriodDto(period),
      totalUnits,
      statusCounts,
      submittedCount,
      notSubmittedCount: statusCounts.DRAFT,
      supplementPendingCount,
      progressPercent: this.calculatePercent(submittedCount, totalUnits),
      finalizedCount,
      notFinalizedCount: totalUnits - finalizedCount,
      officialResults: {
        totalFinalScore: toApiNumber(officialResults._sum.finalScore) ?? 0,
        averageFinalScore: toApiNumber(officialResults._avg.finalScore) ?? 0,
        averageFinalPercent: toApiNumber(officialResults._avg.finalPercent) ?? 0,
      },
      scoreDistribution,
    };
  }

  async getDeductions(periodId: string) {
    await this.findPeriodOrThrow(periodId);
    const scores = await this.prisma.criterionScore.findMany({
      where: {
        evaluation: { periodId, status: "FINALIZED" },
        criterion: { periodId },
        selfScore: { not: null },
        adminScore: { not: null },
      },
      select: {
        criterionId: true,
        selfScore: true,
        adminScore: true,
        criterion: {
          select: {
            code: true,
            name: true,
            sortOrder: true,
          },
        },
      },
    });
    const deductions = new Map<string, DeductionAggregate>();

    for (const score of scores) {
      if (score.selfScore === null || score.adminScore === null) {
        continue;
      }

      const selfScore = decimal(score.selfScore);
      const adminScore = decimal(score.adminScore);
      const pointsDeducted = selfScore.minus(adminScore);

      if (pointsDeducted.lessThanOrEqualTo(0)) {
        continue;
      }

      const current = deductions.get(score.criterionId);

      if (current) {
        current.unitsDeducted += 1;
        current.totalPointsDeducted = current.totalPointsDeducted.plus(pointsDeducted);
        continue;
      }

      deductions.set(score.criterionId, {
        criterionId: score.criterionId,
        code: score.criterion.code,
        name: score.criterion.name,
        sortOrder: score.criterion.sortOrder,
        unitsDeducted: 1,
        totalPointsDeducted: pointsDeducted,
      });
    }

    const items = [...deductions.values()]
      .sort((left, right) => {
        const comparison = right.totalPointsDeducted.comparedTo(
          left.totalPointsDeducted,
        );

        if (comparison !== 0) {
          return comparison;
        }

        if (right.unitsDeducted !== left.unitsDeducted) {
          return right.unitsDeducted - left.unitsDeducted;
        }

        return left.sortOrder - right.sortOrder;
      })
      .map((deduction) => ({
        criterionId: deduction.criterionId,
        code: deduction.code,
        name: deduction.name,
        unitsDeducted: deduction.unitsDeducted,
        totalPointsDeducted: toApiNumber(deduction.totalPointsDeducted) ?? 0,
      }));

    return { periodId, items };
  }

  async getScoreDistribution(periodId: string) {
    await this.findPeriodOrThrow(periodId);
    const distribution = await this.getScoreDistributionForPeriod(periodId);

    return { periodId, ...distribution };
  }

  private async findPeriodOrThrow(periodId: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({
      where: { id: periodId },
      select: {
        id: true,
        year: true,
        name: true,
        phase: true,
        maxTotalScore: true,
      },
    });

    if (!period) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: "Không tìm thấy đợt đánh giá",
      });
    }

    return period;
  }

  private async getScoreDistributionForPeriod(
    periodId: string,
  ): Promise<ScoreDistributionDto> {
    const [thresholds, ratingGroups] = await Promise.all([
      this.prisma.ratingThreshold.findMany({
        where: { periodId },
        orderBy: { minPercent: "desc" },
        select: {
          rating: true,
          label: true,
          color: true,
        },
      }),
      this.prisma.evaluation.groupBy({
        by: ["finalRating"],
        where: { periodId, status: "FINALIZED" },
        _count: { _all: true },
      }),
    ]);
    const countByRating = new Map<string, number>();

    for (const group of ratingGroups) {
      if (group.finalRating) {
        countByRating.set(group.finalRating, group._count._all);
      }
    }

    const finalizedCount = [...countByRating.values()].reduce(
      (total, count) => total + count,
      0,
    );
    const configuredRatings = new Set(
      thresholds.map((threshold) => threshold.rating),
    );
    const configuredItems = thresholds.map((threshold) => {
      const count = countByRating.get(threshold.rating) ?? 0;

      return {
        rating: threshold.rating,
        label: threshold.label,
        color: threshold.color,
        count,
        percent: this.calculatePercent(count, finalizedCount),
      } satisfies ScoreDistributionItemDto;
    });
    const unconfiguredItems = [...countByRating.entries()]
      .filter(([rating]) => !configuredRatings.has(rating))
      .sort(([leftRating], [rightRating]) =>
        leftRating.localeCompare(rightRating),
      )
      .map(([rating, count]) => ({
        rating,
        label: rating,
        color: null,
        count,
        percent: this.calculatePercent(count, finalizedCount),
      } satisfies ScoreDistributionItemDto));

    return { finalizedCount, items: [...configuredItems, ...unconfiguredItems] };
  }

  private createStatusCounts(
    groups: { status: string; _count: { _all: number } }[],
  ): EvaluationStatusCountsDto {
    const counts = EVALUATION_STATUSES.reduce(
      (result, status) => ({ ...result, [status]: 0 }),
      {} as EvaluationStatusCountsDto,
    );

    for (const group of groups) {
      if (this.isEvaluationStatus(group.status)) {
        counts[group.status] = group._count._all;
      }
    }

    return counts;
  }

  private sumStatusCounts(counts: EvaluationStatusCountsDto): number {
    return EVALUATION_STATUSES.reduce(
      (total, status) => total + counts[status],
      0,
    );
  }

  private toPeriodDto(period: {
    id: string;
    year: number;
    name: string;
    phase: string;
    maxTotalScore: Parameters<typeof toApiNumber>[0];
  }): DashboardPeriodDto {
    return {
      ...period,
      maxTotalScore: toApiNumber(period.maxTotalScore) ?? 0,
    };
  }

  private isEvaluationStatus(status: string): status is EvaluationStatus {
    return EVALUATION_STATUSES.includes(status as EvaluationStatus);
  }

  private calculatePercent(value: number, total: number): number {
    return total === 0 ? 0 : this.round((value / total) * 100);
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
