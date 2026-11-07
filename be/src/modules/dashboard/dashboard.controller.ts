import {
  Controller,
  Get,
  Inject,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard, RolesGuard } from "../../common/guards/jwt-auth.guard.js";
import { DashboardDeductionsDto } from "./dto/dashboard-deductions.dto.js";
import { DashboardLeaderboardDto } from "./dto/leaderboard.dto.js";
import { DashboardOverviewDto } from "./dto/dashboard-overview.dto.js";
import { DashboardScoreDistributionDto } from "./dto/score-distribution.dto.js";
import { DashboardService } from "./dashboard.service.js";

@ApiTags("Dashboard")
@ApiBearerAuth("access-token")
@Controller("api/v1/admin/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class DashboardController {
  constructor(
    @Inject(DashboardService)
    private readonly dashboardService: DashboardService
  ) {}

  @Get()
  @ApiOperation({ summary: "Tổng quan dashboard của một đợt đánh giá" })
  @ApiQuery({ name: "periodId", required: true, format: "uuid" })
  @ApiOkResponse({ type: DashboardOverviewDto })
  getOverview(@Query("periodId", ParseUUIDPipe) periodId: string) {
    return this.dashboardService.getOverview(periodId);
  }

  @Get("deductions")
  @ApiOperation({ summary: "Danh sách tiêu chí bị Admin trừ điểm" })
  @ApiQuery({ name: "periodId", required: true, format: "uuid" })
  @ApiOkResponse({ type: DashboardDeductionsDto })
  getDeductions(@Query("periodId", ParseUUIDPipe) periodId: string) {
    return this.dashboardService.getDeductions(periodId);
  }

  @Get("leaderboard")
  @ApiOperation({ summary: "Bảng xếp hạng thời gian thực của một đợt đánh giá" })
  @ApiQuery({ name: "periodId", required: true, format: "uuid" })
  @ApiOkResponse({ type: DashboardLeaderboardDto })
  getLeaderboard(@Query("periodId", ParseUUIDPipe) periodId: string) {
    return this.dashboardService.getLeaderboard(periodId);
  }

  @Get("score-distribution")
  @ApiOperation({ summary: "Phân bố xếp loại của các hồ sơ đã chốt" })
  @ApiQuery({ name: "periodId", required: true, format: "uuid" })
  @ApiOkResponse({ type: DashboardScoreDistributionDto })
  getScoreDistribution(@Query("periodId", ParseUUIDPipe) periodId: string) {
    return this.dashboardService.getScoreDistribution(periodId);
  }
}
