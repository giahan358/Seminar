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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard, RolesGuard } from "../../common/guards/jwt-auth.guard.js";
import { CreateCriterionDto } from "./dto/create-criterion.dto.js";
import { UpdateCriterionDto } from "./dto/update-criterion.dto.js";
import { CriteriaService } from "./criteria.service.js";

@ApiTags("Criteria")
@ApiBearerAuth()
@Controller("api/v1/criteria")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CriteriaController {
  /** Inject dependency tường minh theo mẫu Auth để cùng luồng DB hoạt động trên tsx và bản build ESM */
  constructor(@Inject(CriteriaService) private readonly criteriaService: CriteriaService) {}

  @Get()
  @Roles("ADMIN", "UNIT")
  @ApiOperation({ summary: "Get criteria tree for an evaluation period" })
  @ApiResponse({ status: 200, description: "Root criteria and nested children" })
  findByPeriod(@Query("periodId", ParseUUIDPipe) periodId: string) {
    return this.criteriaService.findByPeriod(periodId);
  }

  @Get(":id")
  @Roles("ADMIN", "UNIT")
  @ApiOperation({ summary: "Get a criterion with its parent and children" })
  @ApiResponse({ status: 200, description: "Criterion details" })
  @ApiResponse({ status: 404, description: "Criterion not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.criteriaService.findOne(id);
  }

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "Create a criterion" })
  @ApiResponse({ status: 201, description: "Criterion created" })
  /** Validate DTO tạo mới và từ chối field ngoài giao ước trước khi chuyển dữ liệu tới service thực hiện quyền ghi */
  create(@Body(createApiValidationPipe(CreateCriterionDto)) dto: CreateCriterionDto) {
    return this.criteriaService.create(dto);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update a criterion" })
  @ApiResponse({ status: 200, description: "Criterion updated" })
  @ApiResponse({ status: 404, description: "Criterion not found" })
  /** Validate DTO cập nhật cùng mã tài nguyên đã qua pipe, chỉ giao phần dữ liệu hợp lệ cho service kiểm nghiệp vụ */
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(createApiValidationPipe(UpdateCriterionDto)) dto: UpdateCriterionDto,
  ) {
    return this.criteriaService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Delete a criterion" })
  @ApiResponse({ status: 200, description: "Criterion deleted" })
  @ApiResponse({ status: 400, description: "Criterion has children or scores" })
  @ApiResponse({ status: 404, description: "Criterion not found" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.criteriaService.remove(id);
  }
}
