import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service.js";

@ApiTags("Health")
@Controller("api/v1/health")
export class HealthController {
  //constructor(private readonly prisma: PrismaService) {}
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Kiểm tra trạng thái API và cơ sở dữ liệu" })
  @ApiResponse({ status: 200, description: "Hệ thống đang hoạt động", schema: { example: { status: "ok", timestamp: "2026-11-03T00:00:00.000Z", database: "up" } } })
  @ApiResponse({ status: 503, description: "Cơ sở dữ liệu không khả dụng" })
  async check(): Promise<{ status: "ok"; timestamp: string; database: "up" }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", timestamp: new Date().toISOString(), database: "up" };
    } catch (error) {
  console.error("[HealthCheck] Database connection failed:", error);

  throw new ServiceUnavailableException({
    code: "DATABASE_UNAVAILABLE",
    message: "Không thể kết nối cơ sở dữ liệu",
  });
}
  }
}