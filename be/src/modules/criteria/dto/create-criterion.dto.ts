import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCriterionDto {
  @ApiProperty({ format: "uuid" })
  periodId!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  parentId?: string | null;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ example: 10 })
  maxScore!: number;

  @ApiPropertyOptional({ nullable: true })
  evidenceRequirement?: string | null;

  @ApiPropertyOptional({ default: true })
  allowText?: boolean;

  @ApiPropertyOptional({ default: true })
  allowFile?: boolean;

  @ApiPropertyOptional({ default: true })
  allowLink?: boolean;

  @ApiPropertyOptional({ default: true })
  evidenceRequired?: boolean;

  @ApiProperty()
  sortOrder!: number;
}
