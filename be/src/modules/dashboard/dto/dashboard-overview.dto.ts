import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EvaluationStatusCountsDto {
  @ApiProperty({ example: 4, type: Number })
  DRAFT!: number;

  @ApiProperty({ example: 12, type: Number })
  PENDING_REVIEW!: number;

  @ApiProperty({ example: 3, type: Number })
  SUPPLEMENT_REQUESTED!: number;

  @ApiProperty({ example: 2, type: Number })
  SUPPLEMENT_SUBMITTED!: number;

  @ApiProperty({ example: 1, type: Number })
  SUPPLEMENT_EXPIRED!: number;

  @ApiProperty({ example: 12, type: Number })
  FINALIZED!: number;
}

export class DashboardPeriodDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ example: 2026, type: Number })
  year!: number;

  @ApiProperty({ example: "Đợt thi đua năm 2026", type: String })
  name!: string;

  @ApiProperty({ example: "FIRST_REVIEW", type: String })
  phase!: string;

  @ApiProperty({ example: 300, type: Number })
  maxTotalScore!: number;
}

export class OfficialResultsDto {
  @ApiProperty({ example: 2550, type: Number })
  totalFinalScore!: number;

  @ApiProperty({ example: 255, type: Number })
  averageFinalScore!: number;

  @ApiProperty({ example: 85, type: Number })
  averageFinalPercent!: number;
}

export class ScoreDistributionItemDto {
  @ApiProperty({ example: "EXCELLENT", type: String })
  rating!: string;

  @ApiProperty({ example: "Hoàn thành xuất sắc nhiệm vụ", type: String })
  label!: string;

  @ApiPropertyOptional({ example: "#16a34a", nullable: true, type: String })
  color!: string | null;

  @ApiProperty({ example: 5, type: Number })
  count!: number;

  @ApiProperty({ example: 41.67, type: Number })
  percent!: number;
}

export class ScoreDistributionDto {
  @ApiProperty({ example: 12, type: Number })
  finalizedCount!: number;

  @ApiProperty({ type: () => ScoreDistributionItemDto, isArray: true })
  items!: ScoreDistributionItemDto[];
}

export class DashboardOverviewDto {
  @ApiProperty({ format: "uuid", type: String })
  periodId!: string;

  @ApiProperty({ type: () => DashboardPeriodDto })
  period!: DashboardPeriodDto;

  @ApiProperty({ example: 34, type: Number })
  totalUnits!: number;

  @ApiProperty({ type: () => EvaluationStatusCountsDto })
  statusCounts!: EvaluationStatusCountsDto;

  @ApiProperty({ example: 30, type: Number })
  submittedCount!: number;

  @ApiProperty({ example: 4, type: Number })
  notSubmittedCount!: number;

  @ApiProperty({ example: 5, type: Number })
  supplementPendingCount!: number;

  @ApiProperty({ example: 88.24, type: Number })
  progressPercent!: number;

  @ApiProperty({ example: 12, type: Number })
  finalizedCount!: number;

  @ApiProperty({ example: 22, type: Number })
  notFinalizedCount!: number;

  @ApiProperty({ type: () => OfficialResultsDto })
  officialResults!: OfficialResultsDto;

  @ApiProperty({ type: () => ScoreDistributionDto })
  scoreDistribution!: ScoreDistributionDto;
}
