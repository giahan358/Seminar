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

@ApiTags("Đợt đánh giá")
@ApiBearerAuth()
@Controller("api/v1/evaluation-periods")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationPeriodsController {
  constructor(private readonly evaluationPeriodsService: EvaluationPeriodsService) {}

  @Get()
  @Roles("ADMIN", "UNIT")
  @ApiOperation({ summary: "Danh sách đợt đánh giá" })
  @ApiResponse({ status: 200, description: "Danh sách đợt đánh giá kèm ngưỡng xếp loại" })
  findAll() {
    return this.evaluationPeriodsService.findAll();
  }

  @Get(":id")
  @Roles("ADMIN", "UNIT")
  @ApiOperation({ summary: "Xem chi tiết đợt đánh giá" })
  @ApiResponse({ status: 200, description: "Thông tin chi tiết đợt đánh giá" })
  @ApiResponse({ status: 404, description: "Không tìm thấy đợt đánh giá" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.evaluationPeriodsService.findOne(id);
  }

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "Tạo đợt đánh giá" })
  @ApiResponse({ status: 201, description: "Tạo đợt đánh giá thành công" })
  create(@GetCurrentUser() user: CurrentUser, @Body() dto: CreateEvaluationPeriodDto) {
    return this.evaluationPeriodsService.create(user.id, dto);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Cập nhật đợt đánh giá" })
  @ApiResponse({ status: 200, description: "Cập nhật đợt đánh giá thành công" })
  @ApiResponse({ status: 404, description: "Không tìm thấy đợt đánh giá" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationPeriodDto,
  ) {
    return this.evaluationPeriodsService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Xóa đợt đánh giá" })
  @ApiResponse({ status: 200, description: "Xóa đợt đánh giá thành công" })
  @ApiResponse({ status: 400, description: "Đợt đánh giá đã có dữ liệu, không thể xóa" })
  @ApiResponse({ status: 404, description: "Không tìm thấy đợt đánh giá" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.evaluationPeriodsService.remove(id);
  }

  @Put(":id/thresholds")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Tạo hoặc cập nhật ngưỡng xếp loại" })
  @ApiResponse({ status: 200, description: "Cập nhật ngưỡng xếp loại thành công" })
  upsertThresholds(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() thresholds: UpsertRatingThresholdDto[],
  ) {
    return this.evaluationPeriodsService.upsertThresholds(id, thresholds);
  }
}
