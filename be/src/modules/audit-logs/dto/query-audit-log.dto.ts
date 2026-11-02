import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class QueryAuditLogDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Trang phải là số nguyên" })
  @Min(1, { message: "Trang phải lớn hơn 0" })
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Số dòng phải là số nguyên" })
  @Min(1, { message: "Số dòng tối thiểu là 1" })
  @Max(100, { message: "Số dòng tối đa là 100" })
  limit?: number;

  @ApiPropertyOptional({ example: "EvaluationPeriod" })
  @IsOptional()
  @IsString({ message: "Loại đối tượng phải là chuỗi" })
  entity?: string;

  @ApiPropertyOptional({ example: "UPDATE" })
  @IsOptional()
  @IsString({ message: "Hành động phải là chuỗi" })
  action?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4", { message: "Mã người thực hiện không hợp lệ" })
  actorId?: string;
}
