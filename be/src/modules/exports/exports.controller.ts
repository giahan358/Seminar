import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { GetCurrentUser } from "../../common/decorators/current-user.js";
import type { CurrentUser } from "../../common/decorators/current-user.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard, RolesGuard } from "../../common/guards/jwt-auth.guard.js";
import { CreateReportExportDto } from "./dto/create-report-export.dto.js";
import { ReportExportQueryDto } from "./dto/report-export-query.dto.js";
import { ExportsService } from "./exports.service.js";

@ApiTags("Report Exports")
@ApiBearerAuth("access-token")
@Controller("api/v1/admin/exports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class ExportsController {
  constructor(
    @Inject(ExportsService)
    private readonly exportsService: ExportsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Tạo báo cáo Excel, PDF hoặc Word" })
  @ApiBody({ type: CreateReportExportDto })
  @ApiResponse({ status: 201, description: "Thông tin báo cáo vừa tạo" })
  create(
    @GetCurrentUser() currentUser: CurrentUser,
    @Body() dto: CreateReportExportDto,
  ) {
    return this.exportsService.create(currentUser.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "Danh sách lịch sử xuất báo cáo" })
  @ApiQuery({ name: "periodId", required: false, format: "uuid" })
  findAll(@Query() query: ReportExportQueryDto) {
    return this.exportsService.findAll(query);
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Tải tệp báo cáo" })
  async download(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.exportsService.getDownload(id);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    response.setHeader("Content-Length", file.buffer.length);
    response.end(file.buffer);
  }

  @Get(":id")
  @ApiOperation({ summary: "Xem metadata của một lần xuất báo cáo" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.exportsService.findOne(id);
  }
}
