import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateEvaluationPeriodDto {
  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ example: "Đánh giá năm 2026" })
  name!: string;

  @ApiPropertyOptional({ example: "SETUP", default: "SETUP" })
  phase?: string;

  @ApiPropertyOptional({ example: 300, default: 300 })
  maxTotalScore?: number;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  selfEvalStart?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  selfEvalDeadline?: string | null;

  @ApiPropertyOptional({ example: 48, default: 48 })
  supplementHours?: number;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  publishedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  finalizedAt?: string | null;
}
