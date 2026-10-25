import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { Prisma } from "../../../generated/prisma/client.js";

export class CreateAuditLogDto {
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  actorId?: string | null;

  @ApiProperty({ example: "UPDATE" })
  action!: string;

  @ApiProperty({ example: "EvaluationPeriod" })
  entity!: string;

  @ApiProperty({ example: "c6b7a2a5-c455-4ccb-a8f9-22ac642e8f05" })
  entityId!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true, nullable: true })
  before?: Prisma.InputJsonValue | null;

  @ApiPropertyOptional({ type: "object", additionalProperties: true, nullable: true })
  after?: Prisma.InputJsonValue | null;

  @ApiPropertyOptional({ nullable: true })
  ip?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  createdAt?: string;
}
