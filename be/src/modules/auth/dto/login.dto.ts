import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({
    type: String,
    example: "admin",
    description: "Tên đăng nhập",
  })
  @IsString({ message: "Tên đăng nhập phải là chuỗi." })
  @IsNotEmpty({ message: "Tên đăng nhập là bắt buộc." })
  username!: string;

  @ApiProperty({
    type: String,
    example: "your-password",
    description: "Mật khẩu",
  })
  @IsString({ message: "Mật khẩu phải là chuỗi." })
  @IsNotEmpty({ message: "Mật khẩu là bắt buộc." })
  password!: string;
}