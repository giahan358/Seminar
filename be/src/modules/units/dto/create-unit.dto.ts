import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { UNIT_TYPES, UNIT_TYPE_MESSAGE } from "../unit-types.js";

export class CreateUnitDto {
  @ApiProperty({ type: String, example: "COSO-001" })
  @IsString({ message: "code phải là chuỗi." })
  @IsNotEmpty({ message: "code là bắt buộc." })
  code!: string;

  @ApiProperty({ type: String, example: "Cơ sở Đoàn 01" })
  @IsString({ message: "name phải là chuỗi." })
  @IsNotEmpty({ message: "name là bắt buộc." })
  name!: string;

  @ApiPropertyOptional({ enum: UNIT_TYPES, nullable: true, example: "DON_VI_TRUC_THUOC" })
  @IsOptional()
  @IsIn(UNIT_TYPES, { message: UNIT_TYPE_MESSAGE })
  unitType?: string | null;

  @ApiPropertyOptional({ type: Number, example: 1, minimum: 0 })
  @IsOptional()
  @IsInt({ message: "sortOrder phải là số nguyên." })
  @Min(0, { message: "sortOrder phải là số nguyên không âm." })
  sortOrder?: number;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @IsBoolean({ message: "isActive phải là true hoặc false." })
  isActive?: boolean;
}