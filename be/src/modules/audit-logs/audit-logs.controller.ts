import { createApiValidationPipe } from "../../common/pipes/api-validation.pipe.js";
import {
  Controller,
  Inject,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard, RolesGuard } from "../../common/guards/jwt-auth.guard.js";
import { AuditLogsService } from "./audit-logs.service.js";
import { QueryAuditLogDto } from "./dto/query-audit-log.dto.js";

@ApiTags("Audit Logs")
@ApiBearerAuth()
@Controller("api/v1/audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AuditLogsController {
  /** Inject dependency tường minh theo mẫu Auth để cùng luồng DB hoạt động trên tsx và bản build ESM */
  constructor(@Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: "List audit log entries" })
  @ApiResponse({ status: 200, description: "Paginated audit logs" })
  /** Validate query phân trang và bộ lọc qua DTO tường minh để cả tsx và bản build trả lỗi trường đúng giao ước */
  findAll(@Query(createApiValidationPipe(QueryAuditLogDto)) query: QueryAuditLogDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an audit log entry" })
  @ApiResponse({ status: 200, description: "Audit log details" })
  @ApiResponse({ status: 404, description: "Audit log not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.auditLogsService.findOne(id);
  }
}
