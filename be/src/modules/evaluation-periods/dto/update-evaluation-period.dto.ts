import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateEvaluationPeriodDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt({ message: "Năm đánh giá phải là số nguyên" })
  @Min(2000, { message: "Năm đánh giá không hợp lệ" })
  year?: number;

  @ApiPropertyOptional({ example: "Đánh giá năm 2026" })
  @IsOptional()
  @IsString({ message: "Tên đợt đánh giá phải là chuỗi" })
  @IsNotEmpty({ message: "Tên đợt đánh giá không được để trống" })
  name?: string;

  @ApiPropertyOptional({ example: "SELF_EVAL" })
  @IsOptional()
  @IsString({ message: "Giai đoạn đánh giá phải là chuỗi" })
  phase?: string;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsNumber({}, { message: "Tổng điểm tối đa phải là số" })
  @Min(0, { message: "Tổng điểm tối đa không được âm" })
  maxTotalScore?: number;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @IsOptional()
  @IsDateString({}, { message: "Thời gian bắt đầu không hợp lệ" })
  selfEvalStart?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @IsOptional()
  @IsDateString({}, { message: "Thời hạn tự đánh giá không hợp lệ" })
  selfEvalDeadline?: string | null;

  @ApiPropertyOptional({ example: 48 })
  @IsOptional()
  @IsInt({ message: "Số giờ bổ sung phải là số nguyên" })
  @Min(0, { message: "Số giờ bổ sung không được âm" })
  supplementHours?: number;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @IsOptional()
  @IsDateString({}, { message: "Thời gian công bố không hợp lệ" })
  publishedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @IsOptional()
  @IsDateString({}, { message: "Thời gian hoàn tất không hợp lệ" })
  finalizedAt?: string | null;
}
