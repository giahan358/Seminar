import { createApiValidationPipe } from "../../common/pipes/api-validation.pipe.js";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { GetCurrentUser } from "../../common/decorators/current-user.js";
import type { Request } from "express";
import { AllowPasswordChange, JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { AuthTokenPairDto, AuthMeDto, AuthLogoutDto } from "./dto/auth-response.dto.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";

@ApiTags("Auth")
@Controller("api/v1/auth")
export class AuthController {
  /** Inject dependency tường minh theo mẫu Auth để cùng luồng DB hoạt động trên tsx và bản build ESM */
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  @ApiOkResponse({ type: AuthTokenPairDto })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng nhập" })
  @ApiBody({ type: LoginDto })
  /** Nhận thông tin đăng nhập qua DTO tường minh để cả tsx và bản build chặn field lạ, sai kiểu trước khi AuthService xác thực */
  login(@Body(createApiValidationPipe(LoginDto)) body: LoginDto, @Req() request?: Request) {
    return this.authService.login(body, request?.ip ?? null);
  }

  /** Lấy hồ sơ an toàn bằng access kể cả khi cần đổi mật khẩu để FE khôi phục đúng màn hình */
  @ApiOkResponse({ type: AuthMeDto })
  @Get("me")
  @AllowPasswordChange()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "[ADMIN, UNIT] Xem tài khoản đang đăng nhập" })
  getMe(@GetCurrentUser() user: CurrentUser) {
    return this.authService.getMe(user.id);
  }

  @ApiOkResponse({ type: AuthTokenPairDto })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Làm mới access token (refresh token xoay vòng)" })
  @ApiBody({ type: RefreshTokenDto })
  /** Validate refreshToken ở biên HTTP trước khi service kiểm token và xoay phiên, không phụ thuộc metadata của tsc */
  refresh(@Body(createApiValidationPipe(RefreshTokenDto)) body: RefreshTokenDto) {
    return this.authService.refresh(body);
  }

  @ApiOkResponse({ type: AuthLogoutDto })
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng xuất và thu hồi refresh token" })
  @ApiBody({ type: RefreshTokenDto })
  /** Validate refreshToken ở biên HTTP rồi chuyển cho service thu hồi phiên theo giao ước hiện tại */
  logout(@Body(createApiValidationPipe(RefreshTokenDto)) body: RefreshTokenDto) {
    return this.authService.logout(body);
  }

  @ApiOkResponse({ type: AuthTokenPairDto })
  @Post("change-password")
  @AllowPasswordChange()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "[ADMIN, UNIT] Đổi mật khẩu khi được cấp tài khoản (chỉ được đổi ở tài khoản của chính mình)" })
  @ApiBody({ type: ChangePasswordDto })
  /** Validate hai trường mật khẩu của chính người dùng hiện tại trước khi service kiểm policy và cập nhật hash */
  changePassword(
    @GetCurrentUser() user: CurrentUser,
    @Body(createApiValidationPipe(ChangePasswordDto)) body: ChangePasswordDto,
    @Req() request?: Request,
  ) {
    return this.authService.changePassword(user, body, request?.ip ?? null);
  }
}
