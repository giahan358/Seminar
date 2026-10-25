import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCriterionDto {
  @ApiPropertyOptional({ format: "uuid" })
  periodId?: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  parentId?: string | null;

  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ example: 10 })
  maxScore?: number;

  @ApiPropertyOptional({ nullable: true })
  evidenceRequirement?: string | null;

  @ApiPropertyOptional()
  allowText?: boolean;

  @ApiPropertyOptional()
  allowFile?: boolean;

  @ApiPropertyOptional()
  allowLink?: boolean;

  @ApiPropertyOptional()
  evidenceRequired?: boolean;

  @ApiPropertyOptional()
  sortOrder?: number;
}
