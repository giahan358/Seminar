import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateUserDto } from "./dto/create-user.dto.js";
import { UpdateUserDto } from "./dto/update-user.dto.js";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("Users")
@ApiBearerAuth("access-token")
@Controller("api/v1/users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @Roles("ADMIN")
  @ApiOperation({ summary: "[ADMIN] Danh sách tài khoản, lọc và phân trang" })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, example: 20 })
  @ApiQuery({ name: "role", required: false, enum: ["ADMIN", "UNIT"] })
  @ApiQuery({ name: "unitId", required: false })
  @ApiQuery({ name: "isActive", required: false, enum: ["true", "false"] })
  findAll(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("role") role?: string,
    @Query("unitId") unitId?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.usersService.findAll({ page, pageSize, role, unitId, isActive });
  }

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "[ADMIN] Tạo tài khoản ADMIN hoặc UNIT (trả mật khẩu tạm một lần)" })
  @ApiBody({ type: CreateUserDto })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(":id")
  @Roles("ADMIN", "UNIT")
  @ApiParam({ name: "id", format: "uuid", description: "UUID của TÀI KHOẢN: lấy từ GET /users, ở trường id của từng dòng (không phải unitId)" })
  @ApiOperation({ summary: "[ADMIN, UNIT] Xem thông tin tài khoản (UNIT chỉ xem chính mình)" })
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.usersService.findOne(id, currentUser);
  }

  @Patch(":id")
  @Roles("ADMIN", "UNIT")
  @ApiParam({ name: "id", format: "uuid", description: "UUID của TÀI KHOẢN: lấy từ GET /users, ở trường id của từng dòng (không phải unitId)" })
  @ApiOperation({ summary: "[ADMIN, UNIT] Cập nhật thông tin tài khoản (UNIT chỉ sửa chính mình)" })
  @ApiBody({ type: UpdateUserDto })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @GetCurrentUser() currentUser: CurrentUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, currentUser, dto);
  }

  @Post(":id/reset-password")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiParam({ name: "id", format: "uuid", description: "UUID của TÀI KHOẢN: lấy từ GET /users, ở trường id của từng dòng (không phải unitId" })
  @ApiOperation({ summary: "[ADMIN] Đặt lại mật khẩu cho UNIT nếu quên mật khẩu và thu hồi phiên cũ" })
  resetPassword(@Param("id", ParseUUIDPipe) id: string) {
    return this.usersService.resetPassword(id);
  }

  @Patch(":id/status")
  @Roles("ADMIN")
  @ApiParam({ name: "id", format: "uuid", description: "UUID của TÀI KHOẢN: lấy từ GET /users, ở trường id của từng dòng (không phải unitId" })
  @ApiOperation({ summary: "[ADMIN] Khóa hoặc kích hoạt tài khoản" })
  @ApiBody({ type: UpdateUserStatusDto })
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @GetCurrentUser() currentUser: CurrentUser,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(id, dto.isActive, currentUser);
  }
}