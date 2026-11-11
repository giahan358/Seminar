import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength, MaxLength } from "class-validator";

/** Ràng buộc kích thước đầu vào trước bcrypt, username được trim còn mật khẩu giữ nguyên để không đổi credential */
export class LoginDto {
  @ApiProperty({
    type: String,
    example: "admin",
    description: "Tên đăng nhập sau khi bỏ khoảng trắng đầu và cuối",
    minLength: 3,
    maxLength: 64,
  })
  @IsString({ message: "Tên đăng nhập phải là chuỗi." })
  @IsNotEmpty({ message: "Tên đăng nhập là bắt buộc." })
  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value)
  @MinLength(3, { message: "Tên đăng nhập phải có ít nhất 3 ký tự." })
  @MaxLength(64, { message: "Tên đăng nhập không được quá 64 ký tự." })
  username!: string;

  @ApiProperty({
    type: String,
    example: "your-password",
    description: "Mật khẩu được giữ nguyên khi xác thực",
    minLength: 1,
    maxLength: 128,
  })
  @IsString({ message: "Mật khẩu phải là chuỗi." })
  @IsNotEmpty({ message: "Mật khẩu là bắt buộc." })
  @MaxLength(128, { message: "Mật khẩu không được quá 128 ký tự." })
  password!: string;
}
