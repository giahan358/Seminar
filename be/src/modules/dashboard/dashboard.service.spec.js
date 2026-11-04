import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../generated/prisma/client.js";
import { DashboardService } from "./dashboard.service.ts";

const period = {
  id: "11111111-1111-4111-8111-111111111111",
  year: 2026,
  name: "Đợt thi đua năm 2026",
  phase: "FIRST_REVIEW",
  maxTotalScore: new Prisma.Decimal(300),
};

function makeService(overrides = {}) {
  const calls = { criterionScoreFindMany: [] };
  const prisma = {
    evaluationPeriod: {
      findUnique: async () => period,
    },
    evaluation: {
      groupBy: async ({ by }) => {
        if (by[0] === "status") {
          return [
            { status: "DRAFT", _count: { _all: 2 } },
            { status: "PENDING_REVIEW", _count: { _all: 4 } },
            { status: "SUPPLEMENT_REQUESTED", _count: { _all: 1 } },
            { status: "SUPPLEMENT_SUBMITTED", _count: { _all: 1 } },
            { status: "FINALIZED", _count: { _all: 2 } },
          ];
        }

        return [
          { finalRating: "EXCELLENT", _count: { _all: 1 } },
          { finalRating: "GOOD", _count: { _all: 1 } },
        ];
      },
      aggregate: async () => ({
        _count: { _all: 2 },
        _sum: { finalScore: new Prisma.Decimal(510) },
        _avg: {
          finalScore: new Prisma.Decimal(255),
          finalPercent: new Prisma.Decimal(85),
        },
      }),
    },
    ratingThreshold: {
      findMany: async () => [
        { rating: "EXCELLENT", label: "Xuất sắc", color: "#16a34a" },
        { rating: "GOOD", label: "Tốt", color: "#eab308" },
        { rating: "PASS", label: "Đạt", color: "#f97316" },
        { rating: "FAIL", label: "Không đạt", color: "#dc2626" },
      ],
    },
    criterionScore: {
      findMany: async (args) => {
        calls.criterionScoreFindMany.push(args);
        return [];
      },
    },
    ...overrides.prisma,
  };

  return { service: new DashboardService(prisma), calls };
}

test("overview only uses finalized records for official results and rating distribution", async () => {
  const { service } = makeService();

  const result = await service.getOverview(period.id);

  assert.equal(result.totalUnits, 10);
  assert.equal(result.submittedCount, 8);
  assert.equal(result.notSubmittedCount, 2);
  assert.equal(result.supplementPendingCount, 2);
  assert.equal(result.progressPercent, 80);
  assert.equal(result.finalizedCount, 2);
  assert.equal(result.notFinalizedCount, 8);
  assert.deepEqual(result.officialResults, {
    totalFinalScore: 510,
    averageFinalScore: 255,
    averageFinalPercent: 85,
  });
  assert.deepEqual(result.scoreDistribution.items, [
    { rating: "EXCELLENT", label: "Xuất sắc", color: "#16a34a", count: 1, percent: 50 },
    { rating: "GOOD", label: "Tốt", color: "#eab308", count: 1, percent: 50 },
    { rating: "PASS", label: "Đạt", color: "#f97316", count: 0, percent: 0 },
    { rating: "FAIL", label: "Không đạt", color: "#dc2626", count: 0, percent: 0 },
  ]);
});

test("deductions only include positive deductions from finalized evaluations", async () => {
  const { service, calls } = makeService({
    prisma: {
      criterionScore: {
        findMany: async (args) => {
          calls.criterionScoreFindMany.push(args);
          return [
            {
              criterionId: "criterion-a",
              selfScore: new Prisma.Decimal(10),
              adminScore: new Prisma.Decimal(8.25),
              criterion: { code: "A1", name: "Tiêu chí A", sortOrder: 2 },
            },
            {
              criterionId: "criterion-a",
              selfScore: new Prisma.Decimal(5),
              adminScore: new Prisma.Decimal(5),
              criterion: { code: "A1", name: "Tiêu chí A", sortOrder: 2 },
            },
            {
              criterionId: "criterion-b",
              selfScore: new Prisma.Decimal(7),
              adminScore: new Prisma.Decimal(3),
              criterion: { code: "B1", name: "Tiêu chí B", sortOrder: 1 },
            },
          ];
        },
      },
    },
  });

  const result = await service.getDeductions(period.id);

  assert.deepEqual(result.items, [
    {
      criterionId: "criterion-b",
      code: "B1",
      name: "Tiêu chí B",
      unitsDeducted: 1,
      totalPointsDeducted: 4,
    },
    {
      criterionId: "criterion-a",
      code: "A1",
      name: "Tiêu chí A",
      unitsDeducted: 1,
      totalPointsDeducted: 1.75,
    },
  ]);
  assert.equal(calls.criterionScoreFindMany.length, 1);
  assert.equal(
    calls.criterionScoreFindMany[0].where.evaluation.status,
    "FINALIZED",
  );
});
