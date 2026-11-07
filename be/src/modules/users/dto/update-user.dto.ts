import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class UpdateUserDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString({ message: "fullName phải là chuỗi." })
  @IsNotEmpty({ message: "fullName không được để trống." })
  fullName?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsEmail({}, { message: "email không hợp lệ." })
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString({ message: "phone phải là chuỗi." })
  @MaxLength(20, { message: "phone tối đa 20 ký tự." })
  phone?: string | null;

  @ApiPropertyOptional({ type: String, enum: ["ADMIN", "UNIT"], description: "Chỉ ADMIN được đổi." })
  @IsOptional()
  @IsIn(["ADMIN", "UNIT"], { message: "role chỉ được là ADMIN hoặc UNIT." })
  role?: "ADMIN" | "UNIT";

  @ApiPropertyOptional({ type: String, nullable: true, description: "Chỉ ADMIN được đổi." })
  @IsOptional()
  @IsUUID("all", { message: "unitId phải là UUID hợp lệ." })
  unitId?: string | null;

}