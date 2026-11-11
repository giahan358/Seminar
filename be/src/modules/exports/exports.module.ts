import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ExportsController } from "./exports.controller.js";
import { ExportsService } from "./exports.service.js";
import { ExcelReportGenerator } from "./generators/excel.generator.js";
import { PdfReportGenerator } from "./generators/pdf.generator.js";
import { WordReportGenerator } from "./generators/word.generator.js";
import { PrismaModule } from "../../prisma/prisma.module.ts";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ConfigModule,
  ],
  controllers: [ExportsController],
  providers: [
    ExportsService,
    ExcelReportGenerator,
    PdfReportGenerator,
    WordReportGenerator,
  ],
  exports: [ExportsService],
})
export class ExportsModule {}
