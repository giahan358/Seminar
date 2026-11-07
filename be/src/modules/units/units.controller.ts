import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { GetCurrentUser } from "../../common/decorators/current-user.js";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard, RolesGuard } from "../../common/guards/jwt-auth.guard.js";
import { CreateUnitDto } from "./dto/create-unit.dto.js";
import { UpdateUnitDto } from "./dto/update-unit.dto.js";
import { UNIT_TYPES } from "./unit-types.js";
import { UnitsService } from "./units.service.js";

@ApiTags("Units")
@ApiBearerAuth("access-token")
@Controller("api/v1/units")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnitsController {
  constructor(
    @Inject(UnitsService)
    private readonly unitsService: UnitsService,
  ) {}

  @Get()
  @Roles("ADMIN", "UNIT")
  @ApiOperation({ summary: "[ADMIN, UNIT] Danh sách đơn vị (UNIT chỉ thấy đơn vị của mình)" })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, example: 20 })
  @ApiQuery({ name: "unitType", required: false, enum: UNIT_TYPES })
  @ApiQuery({ name: "isActive", required: false, enum: ["true", "false"] })
  findAll(
    @GetCurrentUser() currentUser: CurrentUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("unitType") unitType?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.unitsService.findAll(currentUser, {
      page,
      pageSize,
      unitType,
      isActive,
    });
  }

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "[ADMIN] Tạo đơn vị" })
  @ApiBody({ type: CreateUnitDto })
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  // Phải khai báo trước ":id" để không bị nuốt route.
  @Get(":id/users")
  @Roles("ADMIN", "UNIT")
  @ApiParam({ name: "id", format: "uuid", description: "UUID của đơn vị, lấy từ GET /units (trường id)", example: "00000000-0000-4000-8000-000000000101" })
  @ApiOperation({ summary: "[ADMIN, UNIT] Danh sách tài khoản thuộc đơn vị (UNIT chỉ xem đơn vị của mình)" })
  findUsers(
    @Param("id", ParseUUIDPipe) id: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.unitsService.findUsers(id, currentUser);
  }

  @Get(":id")
  @Roles("ADMIN", "UNIT")
  @ApiParam({ name: "id", format: "uuid", description: "UUID của đơn vị, lấy từ GET /units (trường id)", example: "00000000-0000-4000-8000-000000000101" })
  @ApiOperation({ summary: "[ADMIN, UNIT] Chi tiết đơn vị (UNIT chỉ xem đơn vị của mình)" })
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.unitsService.findOne(id, currentUser);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiParam({ name: "id", format: "uuid", description: "UUID của đơn vị, lấy từ GET /units (trường id)", example: "00000000-0000-4000-8000-000000000101" })
  @ApiOperation({ summary: "[ADMIN] Cập nhật đơn vị" })
  @ApiBody({ type: UpdateUnitDto })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.unitsService.update(id, dto);
  }
}