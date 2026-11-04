import { ApiProperty } from "@nestjs/swagger";

export class CriterionDeductionDto {
  @ApiProperty({ format: "uuid", type: String })
  criterionId!: string;

  @ApiProperty({ example: "A1", type: String })
  code!: string;

  @ApiProperty({
    example: "Tổ chức học tập nghị quyết, chủ trương",
    type: String,
  })
  name!: string;

  @ApiProperty({ example: 15, type: Number })
  unitsDeducted!: number;

  @ApiProperty({ example: 25.5, type: Number })
  totalPointsDeducted!: number;
}

export class DashboardDeductionsDto {
  @ApiProperty({ format: "uuid", type: String })
  periodId!: string;

  @ApiProperty({ type: () => CriterionDeductionDto, isArray: true })
  items!: CriterionDeductionDto[];
}
