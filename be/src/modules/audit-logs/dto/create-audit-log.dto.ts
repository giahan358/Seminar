import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { Prisma } from "../../../generated/prisma/client.js";
import { Allow, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateAuditLogDto {
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4", { message: "Mã người thực hiện không hợp lệ" })
  actorId?: string | null;

  @ApiProperty({ example: "UPDATE" })
  @IsString({ message: "Hành động phải là chuỗi" })
  @IsNotEmpty({ message: "Hành động không được để trống" })
  action!: string;

  @ApiProperty({ example: "EvaluationPeriod" })
  @IsString({ message: "Loại đối tượng phải là chuỗi" })
  @IsNotEmpty({ message: "Loại đối tượng không được để trống" })
  entity!: string;

  @ApiProperty({ example: "c6b7a2a5-c455-4ccb-a8f9-22ac642e8f05" })
  @IsString({ message: "Mã đối tượng phải là chuỗi" })
  @IsNotEmpty({ message: "Mã đối tượng không được để trống" })
  entityId!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true, nullable: true })
  @IsOptional()
  @Allow()
  before?: Prisma.InputJsonValue | null;

  @ApiPropertyOptional({ type: "object", additionalProperties: true, nullable: true })
  @IsOptional()
  @Allow()
  after?: Prisma.InputJsonValue | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString({ message: "Địa chỉ IP phải là chuỗi" })
  ip?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @IsDateString({}, { message: "Thời gian ghi nhận không hợp lệ" })
  createdAt?: string;
}
