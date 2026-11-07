import { ApiPropertyOptional } from "@nestjs/swagger";
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

export class UpdateUnitDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString({ message: "code phải là chuỗi." })
  @IsNotEmpty({ message: "code không được để trống." })
  code?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString({ message: "name phải là chuỗi." })
  @IsNotEmpty({ message: "name không được để trống." })
  name?: string;

  @ApiPropertyOptional({ enum: UNIT_TYPES, nullable: true })
  @IsOptional()
  @IsIn(UNIT_TYPES, { message: UNIT_TYPE_MESSAGE })
  unitType?: string | null;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @IsOptional()
  @IsInt({ message: "sortOrder phải là số nguyên." })
  @Min(0, { message: "sortOrder phải là số nguyên không âm." })
  sortOrder?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean({ message: "isActive phải là true hoặc false." })
  isActive?: boolean;
}