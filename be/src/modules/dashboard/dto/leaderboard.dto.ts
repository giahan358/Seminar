import { ApiProperty } from "@nestjs/swagger";

export class LeaderboardItemDto {
  @ApiProperty({ example: 1, type: Number })
  rank!: number;

  @ApiProperty({ example: 1, type: Number })
  scoreRank!: number;

  @ApiProperty({ format: "uuid", type: String })
  evaluationId!: string;

  @ApiProperty({ format: "uuid", type: String })
  unitId!: string;

  @ApiProperty({ example: "DV001", type: String })
  unitCode!: string;

  @ApiProperty({ example: "Đơn vị A", type: String })
  unitName!: string;

  @ApiProperty({ example: "PENDING_REVIEW", type: String })
  status!: string;

  @ApiProperty({
    example: "2026-01-15T08:00:00.000Z",
    format: "date-time",
    nullable: true,
    type: String,
  })
  submittedAt!: string | null;

  @ApiProperty({ example: 300, type: Number })
  maxTotalScore!: number;

  @ApiProperty({ example: 280, type: Number })
  selfTotal!: number;

  @ApiProperty({ example: 285, type: Number })
  currentTotal!: number;

  @ApiProperty({ example: 95, type: Number })
  currentPercent!: number;

  @ApiProperty({ example: "EXCELLENT", nullable: true, type: String })
  suggestedRating!: string | null;
}

export class DashboardLeaderboardDto {
  @ApiProperty({ format: "uuid", type: String })
  periodId!: string;

  @ApiProperty({ example: 34, type: Number })
  totalUnits!: number;

  @ApiProperty({ type: () => LeaderboardItemDto, isArray: true })
  items!: LeaderboardItemDto[];
}
