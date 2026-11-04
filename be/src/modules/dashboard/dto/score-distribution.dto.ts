import { ApiProperty } from "@nestjs/swagger";
import { ScoreDistributionDto } from "./dashboard-overview.dto.js";

export class DashboardScoreDistributionDto extends ScoreDistributionDto {
  @ApiProperty({ format: "uuid", type: String })
  periodId!: string;
}
