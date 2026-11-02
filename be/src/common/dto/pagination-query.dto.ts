import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Trang phải là số nguyên" })
  @Min(1, { message: "Trang phải lớn hơn hoặc bằng 1" })
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Kích thước trang phải là số nguyên" })
  @Min(1, { message: "Kích thước trang phải lớn hơn hoặc bằng 1" })
  @Max(100, { message: "Kích thước trang không được vượt quá 100" })
  pageSize = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: "Trường sắp xếp phải là chuỗi" })
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"], { message: "Thứ tự sắp xếp chỉ được là asc hoặc desc" })
  sortOrder: "asc" | "desc" = "desc";
}
