import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({
    type: String,
    example: "dán-refreshToken-nhận-được-khi-đăng-nhập",
    description: "Refresh token nhận được khi đăng nhập",
  })
  @IsString({ message: "Refresh token phải là chuỗi." })
  @IsNotEmpty({ message: "Refresh token là bắt buộc." })
  refreshToken!: string;
}