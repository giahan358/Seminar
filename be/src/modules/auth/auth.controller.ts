import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { GetCurrentUser } from "../../common/decorators/current-user.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";

@ApiTags("Auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng nhập" })
  @ApiBody({ type: LoginDto })
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "[ADMIN, UNIT] Xem tài khoản đang đăng nhập" })
  getMe(@GetCurrentUser() user: CurrentUser) {
    return this.authService.getMe(user.id);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Làm mới access token (refresh token xoay vòng)" })
  @ApiBody({ type: RefreshTokenDto })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng xuất và thu hồi refresh token" })
  @ApiBody({ type: RefreshTokenDto })
  logout(@Body() body: RefreshTokenDto) {
    return this.authService.logout(body);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "[ADMIN, UNIT] Đổi mật khẩu khi được cấp tài khoản (chỉ được đổi ở tài khoản của chính mình)" })
  @ApiBody({ type: ChangePasswordDto })
  changePassword(
    @GetCurrentUser() user: CurrentUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, body);
  }
}