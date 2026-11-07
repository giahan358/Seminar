import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({
    type: String,
    example: "current-password",
    description: "Mật khẩu hiện tại",
  })
  @IsString({ message: "Mật khẩu hiện tại phải là chuỗi." })
  @IsNotEmpty({ message: "Mật khẩu hiện tại là bắt buộc." })
  currentPassword!: string;

  @ApiProperty({
    type: String,
    example: "new-password-123",
    description: "Mật khẩu mới, 8-72 ký tự (bcrypt chỉ xét 72 byte đầu)",
    minLength: 8,
    maxLength: 72,
  })
  @IsString({ message: "Mật khẩu mới phải là chuỗi." })
  @MinLength(8, { message: "Mật khẩu mới phải có ít nhất 8 ký tự." })
  @MaxLength(72, { message: "Mật khẩu mới không được quá 72 ký tự." })
  newPassword!: string;
}