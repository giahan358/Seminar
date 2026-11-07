import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ type: String, example: "coso35" })
  @IsString({ message: "username phải là chuỗi." })
  @IsNotEmpty({ message: "username là bắt buộc." })
  username!: string;

  @ApiProperty({ type: String, example: "Cơ sở Đoàn demo 35" })
  @IsString({ message: "fullName phải là chuỗi." })
  @IsNotEmpty({ message: "fullName là bắt buộc." })
  fullName!: string;

  @ApiProperty({ type: String, enum: ["ADMIN", "UNIT"], example: "UNIT" })
  @IsIn(["ADMIN", "UNIT"], { message: "role chỉ được là ADMIN hoặc UNIT." })
  role!: "ADMIN" | "UNIT";

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Bắt buộc với role UNIT (lấy id từ GET /units); bỏ trống với ADMIN.",
  })
  @IsOptional()
  @IsUUID("all", { message: "unitId phải là UUID hợp lệ." })
  unitId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: "coso35@example.com" })
  @IsOptional()
  @IsEmail({}, { message: "email không hợp lệ." })
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: "0901234567" })
  @IsOptional()
  @IsString({ message: "phone phải là chuỗi." })
  @MaxLength(20, { message: "phone tối đa 20 ký tự." })
  phone?: string | null;
}