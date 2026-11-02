import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin", description: "Tên đăng nhập", type: String })
  @IsString({ message: "Tên đăng nhập phải là chuỗi" })
  @IsNotEmpty({ message: "Tên đăng nhập không được để trống" })
  username!: string;

  @ApiProperty({ example: "123456", description: "Mật khẩu", type: String })
  @IsString({ message: "Mật khẩu phải là chuỗi" })
  @IsNotEmpty({ message: "Mật khẩu không được để trống" })
  password!: string;
}
