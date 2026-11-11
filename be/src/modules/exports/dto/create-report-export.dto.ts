import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsUUID,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";

export const REPORT_TYPES = [
  "SUMMARY_ALL_UNITS",
  "UNIT_APPRAISAL_MINUTES",
] as const;

export const REPORT_FORMATS = ["XLSX", "PDF", "DOCX"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportFormat = (typeof REPORT_FORMATS)[number];

@ValidatorConstraint({ name: "reportEvaluationScope", async: false })
class ReportEvaluationScopeConstraint 
  implements ValidatorConstraintInterface
{
  validate(evaluationId: unknown, args: ValidationArguments): boolean {
    const body = args.object as CreateReportExportDto;

    if (body.reportType === "SUMMARY_ALL_UNITS") {
      return evaluationId === undefined || evaluationId === null;
    }

    if (body.reportType === "UNIT_APPRAISAL_MINUTES") {
      return typeof evaluationId === "string" && evaluationId.length > 0;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const body = args.object as CreateReportExportDto;

    return body.reportType === "SUMMARY_ALL_UNITS"
      ? "evaluationId không được cung cấp cho báo cáo SUMMARY_ALL_UNITS"
      : "evaluationId là bắt buộc cho báo cáo UNIT_APPRAISAL_MINUTES";
  }
}

export class CreateReportExportDto {
  @ApiProperty({
    type: String,
    format: "uuid",
    description: "ID đợt đánh giá",
  })
  @IsUUID("4", { message: "periodId phải là UUID hợp lệ" })
  periodId!: string;

  @ApiPropertyOptional({
    type: String,
    format: "uuid",
    description:
      "Bắt buộc với UNIT_APPRAISAL_MINUTES; không được gửi với SUMMARY_ALL_UNITS",
  })
  @IsOptional()
  @IsUUID("4", { message: "evaluationId phải là UUID hợp lệ" })
  @Validate(ReportEvaluationScopeConstraint)
  evaluationId?: string;

  @ApiProperty({
    enum: REPORT_TYPES,
    enumName: "ReportType",
  })
  @IsIn(REPORT_TYPES, { message: "reportType không được hỗ trợ" })
  reportType!: ReportType;

  @ApiProperty({
    enum: REPORT_FORMATS,
    enumName: "ReportFormat",
  })
  @IsIn(REPORT_FORMATS, { message: "format không được hỗ trợ" })
  format!: ReportFormat;
}
