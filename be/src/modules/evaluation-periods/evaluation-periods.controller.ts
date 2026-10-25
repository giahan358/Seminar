import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { GetCurrentUser } from "../../common/decorators/current-user.js";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard, RolesGuard } from "../../common/guards/jwt-auth.guard.js";
import { CreateEvaluationPeriodDto } from "./dto/create-evaluation-period.dto.js";
import { UpdateEvaluationPeriodDto } from "./dto/update-evaluation-period.dto.js";
import { UpsertRatingThresholdDto } from "./dto/upsert-rating-threshold.dto.js";
import { EvaluationPeriodsService } from "./evaluation-periods.service.js";

@ApiTags("Evaluation Periods")
@ApiBearerAuth()
@Controller("api/v1/evaluation-periods")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationPeriodsController {
  constructor(private readonly evaluationPeriodsService: EvaluationPeriodsService) {}

  @Get()
  @Roles("ADMIN", "UNIT")
  @ApiOperation({ summary: "List evaluation periods" })
  @ApiResponse({ status: 200, description: "Evaluation periods with rating thresholds" })
  findAll() {
    return this.evaluationPeriodsService.findAll();
  }

  @Get(":id")
  @Roles("ADMIN", "UNIT")
  @ApiOperation({ summary: "Get an evaluation period" })
  @ApiResponse({ status: 200, description: "Evaluation period details" })
  @ApiResponse({ status: 404, description: "Evaluation period not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.evaluationPeriodsService.findOne(id);
  }

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "Create an evaluation period" })
  @ApiResponse({ status: 201, description: "Evaluation period created" })
  create(@GetCurrentUser() user: CurrentUser, @Body() dto: CreateEvaluationPeriodDto) {
    return this.evaluationPeriodsService.create(user.id, dto);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update an evaluation period" })
  @ApiResponse({ status: 200, description: "Evaluation period updated" })
  @ApiResponse({ status: 404, description: "Evaluation period not found" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationPeriodDto,
  ) {
    return this.evaluationPeriodsService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Delete an evaluation period" })
  @ApiResponse({ status: 200, description: "Evaluation period deleted" })
  @ApiResponse({ status: 400, description: "Period already has evaluations" })
  @ApiResponse({ status: 404, description: "Evaluation period not found" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.evaluationPeriodsService.remove(id);
  }

  @Put(":id/thresholds")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Create or update rating thresholds" })
  @ApiResponse({ status: 200, description: "Rating thresholds upserted" })
  upsertThresholds(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() thresholds: UpsertRatingThresholdDto[],
  ) {
    return this.evaluationPeriodsService.upsertThresholds(id, thresholds);
  }
}
