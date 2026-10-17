import { http, HttpResponse } from "msw";

const evaluationPeriods = [
  {
    id: "period-2026",
    name: "Thi đua công tác Đoàn năm 2026",
    year: 2026,
    phase: "SELF_EVALUATION",
    selfEvalStart: "2026-10-01T00:00:00.000Z",
    selfEvalDeadline: "2026-11-01T23:59:59.000Z",
    supplementHours: 48,
    maxTotalScore: 300,
  },
];

export const handlers = [
  http.get("*/api/v1/evaluation-periods", ({ request }) => {
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const phase = url.searchParams.get("phase");
    const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number(url.searchParams.get("pageSize")) || 20, 1),
      100,
    );

    const filteredPeriods = evaluationPeriods.filter(
      (period) =>
        (!year || String(period.year) === year) &&
        (!phase || period.phase === phase),
    );
    const start = (page - 1) * pageSize;

    return HttpResponse.json({
      items: filteredPeriods.slice(start, start + pageSize),
      page,
      pageSize,
      total: filteredPeriods.length,
    });
  }),
];
