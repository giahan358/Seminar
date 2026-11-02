import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateCriterionDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4", { message: "Mã đợt đánh giá không hợp lệ" })
  periodId!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4", { message: "Mã tiêu chí cha không hợp lệ" })
  parentId?: string | null;

  @ApiProperty()
  @IsString({ message: "Mã tiêu chí phải là chuỗi" })
  @IsNotEmpty({ message: "Mã tiêu chí không được để trống" })
  code!: string;

  @ApiProperty()
  @IsString({ message: "Tên tiêu chí phải là chuỗi" })
  @IsNotEmpty({ message: "Tên tiêu chí không được để trống" })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString({ message: "Mô tả phải là chuỗi" })
  description?: string | null;

  @ApiProperty({ example: 10 })
  @IsNumber({}, { message: "Điểm tối đa phải là số" })
  @Min(0, { message: "Điểm tối đa không được âm" })
  maxScore!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString({ message: "Yêu cầu minh chứng phải là chuỗi" })
  evidenceRequirement?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: "allowText phải là giá trị đúng hoặc sai" })
  allowText?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: "allowFile phải là giá trị đúng hoặc sai" })
  allowFile?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: "allowLink phải là giá trị đúng hoặc sai" })
  allowLink?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: "evidenceRequired phải là giá trị đúng hoặc sai" })
  evidenceRequired?: boolean;

  @ApiProperty()
  @IsInt({ message: "Thứ tự sắp xếp phải là số nguyên" })
  sortOrder!: number;
}
