import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateUserStatusDto {
  @ApiProperty({ type: Boolean, example: false, description: "false = khóa, true = kích hoạt" })
  @IsBoolean({ message: "isActive phải là true hoặc false." })
  isActive!: boolean;
}