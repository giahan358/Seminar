import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpsertRatingThresholdDto {
  @ApiProperty({ example: "A" })
  rating!: string;

  @ApiProperty({ example: "Xuất sắc" })
  label!: string;

  @ApiProperty({ example: 90 })
  minPercent!: number;

  @ApiPropertyOptional({ default: false })
  minExclusive?: boolean;

  @ApiPropertyOptional({ example: "#16a34a", nullable: true })
  color?: string | null;
}
