import { ApiArrayValidationPipe } from "../../common/pipes/api-validation.pipe.js";
import { createApiValidationPipe } from "../../common/pipes/api-validation.pipe.js";
import {
  Body,
  Controller,
  Inject,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { GetCurrentUser } from "../../common/decorators/current-user.js";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto.js";
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
  /** Inject dependency tường minh theo mẫu Auth để cùng luồng DB hoạt động trên tsx và bản build ESM */
  constructor(@Inject(EvaluationPeriodsService) private readonly evaluationPeriodsService: EvaluationPeriodsService) {}

  @Get()
  @Roles("ADMIN", "UNIT")
  @ApiOperation({ summary: "Danh sách đợt đánh giá" })
  @ApiResponse({ status: 200, description: "Danh sách đợt đánh giá kèm ngưỡng xếp loại" })
  /** Validate query phân trang và bộ lọc qua DTO tường minh để cả tsx và bản build trả lỗi trường đúng giao ước */
  findAll(@Query(createApiValidationPipe(PaginationQueryDto)) query: PaginationQueryDto) {
    return this.evaluationPeriodsService.findAll(query);
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
  /** Validate DTO tạo mới và từ chối field ngoài giao ước trước khi chuyển dữ liệu tới service thực hiện quyền ghi */
  create(@GetCurrentUser() user: CurrentUser, @Body(createApiValidationPipe(CreateEvaluationPeriodDto)) dto: CreateEvaluationPeriodDto) {
    return this.evaluationPeriodsService.create(user.id, dto);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Cập nhật đợt đánh giá" })
  @ApiResponse({ status: 200, description: "Cập nhật đợt đánh giá thành công" })
  @ApiResponse({ status: 404, description: "Không tìm thấy đợt đánh giá" })
  /** Validate DTO cập nhật cùng mã tài nguyên đã qua pipe, chỉ giao phần dữ liệu hợp lệ cho service kiểm nghiệp vụ */
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(createApiValidationPipe(UpdateEvaluationPeriodDto)) dto: UpdateEvaluationPeriodDto,
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
  @ApiBody({ type: [UpsertRatingThresholdDto] })
  @Roles("ADMIN")
  @ApiOperation({ summary: "Tạo hoặc cập nhật ngưỡng xếp loại" })
  @ApiResponse({ status: 200, description: "Cập nhật ngưỡng xếp loại thành công" })
  /** Giữ body là mảng ngưỡng, validate từng phần tử kèm chỉ số trước transaction để không ghi dữ liệu sai cấu trúc */
  upsertThresholds(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ApiArrayValidationPipe(UpsertRatingThresholdDto)) thresholds: UpsertRatingThresholdDto[],
  ) {
    return this.evaluationPeriodsService.upsertThresholds(id, thresholds);
  }
}
