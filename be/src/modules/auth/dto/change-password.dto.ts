import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength, Matches } from "class-validator";

/** DTO chặn sai kiểu và policy cơ bản, service kiểm thêm giới hạn byte và so bcrypt với credential trong DB */
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
    description: "Mật khẩu mới, ít nhất 10 ký tự gồm chữ và số, tối đa 72 byte UTF-8",
    minLength: 10,
    maxLength: 72,
  })
  @IsString({ message: "Mật khẩu mới phải là chuỗi." })
  @MinLength(10, { message: "Mật khẩu mới phải có ít nhất 10 ký tự." })
  @Matches(/^(?=.*\p{L})(?=.*[0-9])[\s\S]+$/u, { message: "Mật khẩu mới phải gồm chữ và số." })
  @MaxLength(72, { message: "Mật khẩu mới không được quá 72 ký tự." })
  newPassword!: string;
}
