import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertRatingThresholdDto {
  @ApiProperty({ example: "EXCELLENT" })
  @IsString({ message: "Mức xếp loại phải là chuỗi" })
  @IsNotEmpty({ message: "Mức xếp loại không được để trống" })
  rating!: string;

  @ApiProperty({ example: "Xuất sắc" })
  @IsString({ message: "Tên mức xếp loại phải là chuỗi" })
  @IsNotEmpty({ message: "Tên mức xếp loại không được để trống" })
  label!: string;

  @ApiProperty({ example: 90 })
  @IsNumber({}, { message: "Tỷ lệ tối thiểu phải là số" })
  @Min(0, { message: "Tỷ lệ tối thiểu không được nhỏ hơn 0" })
  @Max(100, { message: "Tỷ lệ tối thiểu không được lớn hơn 100" })
  minPercent!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: "Điều kiện ngưỡng phải là đúng hoặc sai" })
  minExclusive?: boolean;

  @ApiPropertyOptional({ example: "#16a34a", nullable: true })
  @IsOptional()
  @IsString({ message: "Màu sắc phải là chuỗi" })
  color?: string | null;
}
