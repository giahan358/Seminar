import {
  Body,
  Controller,
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
  constructor(private readonly criteriaService: CriteriaService) {}

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
  create(@Body() dto: CreateCriterionDto) {
    return this.criteriaService.create(dto);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update a criterion" })
  @ApiResponse({ status: 200, description: "Criterion updated" })
  @ApiResponse({ status: 404, description: "Criterion not found" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCriterionDto,
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
