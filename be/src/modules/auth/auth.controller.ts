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
import { ApiProperty, ApiBody, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service.js";


export class LoginDto {
  @ApiProperty({ 
    example: 'admin', 
    description: 'Tên đăng nhập', 
    type: String 
  })
  username?: string;

  @ApiProperty({ 
    example: '123456', 
    description: 'Mật khẩu', 
    type: String 
  })
  password?: string;
}

@ApiTags('Auth') 
@Controller("api/v1/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  login(@Body() body: LoginDto) {
    console.log("Body nhận được:", body); 
    return this.authService.login(body);
  }

}