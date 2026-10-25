import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateEvaluationPeriodDto {
  @ApiPropertyOptional({ example: 2026 })
  year?: number;

  @ApiPropertyOptional({ example: "Đánh giá năm 2026" })
  name?: string;

  @ApiPropertyOptional({ example: "SELF_EVALUATION" })
  phase?: string;

  @ApiPropertyOptional({ example: 300 })
  maxTotalScore?: number;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  selfEvalStart?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  selfEvalDeadline?: string | null;

  @ApiPropertyOptional({ example: 48 })
  supplementHours?: number;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  publishedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  finalizedAt?: string | null;
}
