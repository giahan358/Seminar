import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsUUID,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto.js";
import {
  REPORT_FORMATS,
  REPORT_TYPES,
} from "./create-report-export.dto.js";

export class ReportExportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4", { message: "periodId phải là UUID hợp lệ" })
  periodId?: string;

  @ApiPropertyOptional({ enum: REPORT_TYPES })
  @IsOptional()
  @IsIn(REPORT_TYPES, { message: "reportType không được hỗ trợ" })
  reportType?: (typeof REPORT_TYPES)[number];

  @ApiPropertyOptional({ enum: REPORT_FORMATS })
  @IsOptional()
  @IsIn(REPORT_FORMATS, { message: "format không được hỗ trợ" })
  format?: (typeof REPORT_FORMATS)[number];
}
