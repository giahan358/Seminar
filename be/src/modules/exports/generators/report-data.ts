export interface ReportPeriodData {
  id: string;
  year: number;
  name: string;
  phase: string;
  maxTotalScore: number;
}

export interface SummaryUnitRow {
  unitCode: string;
  unitName: string;
  evaluationStatus: string;
  submittedAt: Date | null;
  finalScore: number | null;
  finalPercent: number | null;
  finalRating: string | null;
}

export interface SummaryReportData {
  period: ReportPeriodData;
  rows: SummaryUnitRow[];
}

export interface AppraisalScoreRow {
  code: string;
  name: string;
  maxScore: number;
  selfScore: number | null;
  adminScore: number | null;
  currentScore: number | null;
  selfNote: string | null;
  adminComment: string | null;
  sortOrder: number;
}

export interface AppraisalFeedbackRow {
  type: string;
  content: string;
  authorName: string;
  createdAt: Date;
}

export interface AppraisalReportData {
  period: ReportPeriodData;
  evaluation: {
    id: string;
    status: string;
    submittedAt: Date | null;
    finalizedAt: Date | null;
    finalScore: number | null;
    finalPercent: number | null;
    finalRating: string | null;
  };
  unit: {
    code: string;
    name: string;
  };
  scores: AppraisalScoreRow[];
  feedbacks: AppraisalFeedbackRow[];
}

export interface GeneratedReport {
  buffer: Buffer;
  contentType: string;
  extension: string;
}
