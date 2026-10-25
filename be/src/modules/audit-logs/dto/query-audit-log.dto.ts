import { ApiPropertyOptional } from "@nestjs/swagger";

export class QueryAuditLogDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  limit?: number;

  @ApiPropertyOptional({ example: "EvaluationPeriod" })
  entity?: string;

  @ApiPropertyOptional({ example: "UPDATE" })
  action?: string;

  @ApiPropertyOptional({ format: "uuid" })
  actorId?: string;
}
