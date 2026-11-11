import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ERROR_CODES } from "../../common/constants/error-codes.js";
import { buildPaginationOptions, createPaginatedResult } from "../../common/utils/pagination.util.js";
import type { CreateReportExportDto, ReportFormat } from "./dto/create-report-export.dto.js";
import type { ReportExportQueryDto } from "./dto/report-export-query.dto.js";
import { ExcelReportGenerator } from "./generators/excel.generator.js";
import { PdfReportGenerator } from "./generators/pdf.generator.js";
import { WordReportGenerator } from "./generators/word.generator.js";
import type {
  AppraisalReportData,
  GeneratedReport,
  ReportPeriodData,
  SummaryReportData,
} from "./generators/report-data.js";

@Injectable()
export class ExportsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(ConfigService)
    private readonly configService: ConfigService,

    @Inject(ExcelReportGenerator)
    private readonly excelGenerator: ExcelReportGenerator,

    @Inject(PdfReportGenerator)
    private readonly pdfGenerator: PdfReportGenerator,

    @Inject(WordReportGenerator)
    private readonly wordGenerator: WordReportGenerator,
  ) {}

  async create(createdById: string, dto: CreateReportExportDto) {
    const period = await this.prisma.evaluationPeriod.findUnique({
      where: { id: dto.periodId },
      select: {
        id: true,
        year: true,
        name: true,
        phase: true,
        maxTotalScore: true,
      },
    });

    if (!period) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: "Không tìm thấy kỳ đánh giá",
      });
    }

    let generated: GeneratedReport;
    let evaluationId: string | null = null;
    const periodData: ReportPeriodData = {
      ...period,
      maxTotalScore: Number(period.maxTotalScore),
    };

    if (dto.reportType === "SUMMARY_ALL_UNITS") {
      if (dto.evaluationId) {
        throw new BadRequestException({
          code: ERROR_CODES.BUSINESS_RULE_VIOLATION,
          message: "SUMMARY_ALL_UNITS không được gắn với evaluationId",
        });
      }

      const data = await this.getSummaryData(periodData);
      generated = await this.generate(dto.format, "summary", data);
    } else {
      if (!dto.evaluationId) {
        throw new BadRequestException({
          code: ERROR_CODES.BUSINESS_RULE_VIOLATION,
          message: "UNIT_APPRAISAL_MINUTES yêu cầu evaluationId",
        });
      }

      const data = await this.getAppraisalData(
        periodData,
        dto.evaluationId,
        dto.periodId,
      );
      evaluationId = dto.evaluationId;
      generated = await this.generate(dto.format, "appraisal", data);
    }

    const id = randomUUID();
    const fileName = this.buildFileName(
      dto.reportType,
      periodData.year,
      generated.extension,
    );
    const root = this.getStorageRoot();
    const relativePath = join(periodData.id, `${id}-${fileName}`);
    const absolutePath = resolve(root, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, generated.buffer, { flag: "wx" });

    try {
      const record = await this.prisma.reportExport.create({
        data: {
          id,
          periodId: dto.periodId,
          evaluationId,
          reportType: dto.reportType,
          format: dto.format,
          storagePath: relativePath,
          fileName,
          sizeBytes: BigInt(generated.buffer.length),
          createdById,
          createdAt: new Date(),
        },
      });

      return this.toMetadata(record);
    } catch {
      await rm(absolutePath, { force: true }).catch(() => undefined);
      throw new InternalServerErrorException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: "Không thể lưu thông tin báo cáo vừa tạo",
      });
    }
  }

  async findAll(query: ReportExportQueryDto) {
    const where = {
      ...(query.periodId && { periodId: query.periodId }),
      ...(query.reportType && { reportType: query.reportType }),
      ...(query.format && { format: query.format }),
    };

    const { skip, take, orderBy } = buildPaginationOptions(
      query,
      ["createdAt"],
    );
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reportExport.findMany({ where, orderBy, skip, take }),
      this.prisma.reportExport.count({ where }),
    ]);

    return createPaginatedResult(
      items.map((item) => this.toMetadata(item)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string) {
    const record = await this.findRecordOrThrow(id);
    return this.toMetadata(record);
  }

  async getDownload(id: string) {
    const record = await this.findRecordOrThrow(id);
    const absolutePath = this.resolveStoragePath(record.storagePath);

    try {
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        throw new Error("Stored path is not a file");
      }
      const buffer = await readFile(absolutePath);
      return {
        buffer,
        fileName: record.fileName ?? basename(absolutePath),
        contentType: this.getContentType(record.format as ReportFormat),
      };
    } catch {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: "Không tìm thấy tệp báo cáo trên storage",
      });
    }
  }

  private async getSummaryData(
    period: ReportPeriodData,
  ): Promise<SummaryReportData> {
    const units = await this.prisma.unit.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        code: true,
        name: true,
        evaluations: {
          where: { periodId: period.id },
          select: {
            status: true,
            submittedAt: true,
            finalScore: true,
            finalPercent: true,
            finalRating: true,
          },
        },
      },
    });

    return {
      period,
      rows: units.map((unit) => {
        const evaluation = unit.evaluations[0];
        return {
          unitCode: unit.code,
          unitName: unit.name,
          evaluationStatus: evaluation?.status ?? "CHƯA CÓ ĐÁNH GIÁ",
          submittedAt: evaluation?.submittedAt ?? null,
          finalScore: evaluation?.finalScore === null || !evaluation
            ? null
            : Number(evaluation.finalScore),
          finalPercent: evaluation?.finalPercent === null || !evaluation
            ? null
            : Number(evaluation.finalPercent),
          finalRating: evaluation?.finalRating ?? null,
        };
      }),
    };
  }

  private async getAppraisalData(
    period: ReportPeriodData,
    evaluationId: string,
    periodId: string,
  ): Promise<AppraisalReportData> {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        unit: { select: { code: true, name: true } },
        criterionScores: {
          include: {
            criterion: {
              select: { code: true, name: true, maxScore: true, sortOrder: true },
            },
          },
          orderBy: { criterion: { sortOrder: "asc" } },
        },
        feedbacks: {
          include: { author: { select: { fullName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: "Không tìm thấy phiếu đánh giá",
      });
    }

    if (evaluation.periodId !== periodId) {
      throw new BadRequestException({
        code: ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: "Phiếu đánh giá không thuộc kỳ đánh giá đã chọn",
      });
    }

    return {
      period,
      evaluation: {
        id: evaluation.id,
        status: evaluation.status,
        submittedAt: evaluation.submittedAt,
        finalizedAt: evaluation.finalizedAt,
        finalScore: evaluation.finalScore === null
          ? null
          : Number(evaluation.finalScore),
        finalPercent: evaluation.finalPercent === null
          ? null
          : Number(evaluation.finalPercent),
        finalRating: evaluation.finalRating,
      },
      unit: evaluation.unit,
      scores: evaluation.criterionScores.map((score) => {
        const selfScore = score.selfScore === null
          ? null
          : Number(score.selfScore);
        const adminScore = score.adminScore === null
          ? null
          : Number(score.adminScore);
        return {
          code: score.criterion.code,
          name: score.criterion.name,
          maxScore: Number(score.criterion.maxScore),
          selfScore,
          adminScore,
          currentScore: adminScore ?? selfScore,
          selfNote: score.selfNote,
          adminComment: score.adminComment,
          sortOrder: score.criterion.sortOrder,
        };
      }),
      feedbacks: evaluation.feedbacks.map((feedback) => ({
        type: feedback.type,
        content: feedback.content,
        authorName: feedback.author.fullName,
        createdAt: feedback.createdAt,
      })),
    };
  }

  private generate(
    format: ReportFormat,
    type: "summary",
    data: SummaryReportData,
  ): Promise<GeneratedReport>;
  private generate(
    format: ReportFormat,
    type: "appraisal",
    data: AppraisalReportData,
  ): Promise<GeneratedReport>;
  private generate(
    format: ReportFormat,
    type: "summary" | "appraisal",
    data: SummaryReportData | AppraisalReportData,
  ): Promise<GeneratedReport> {
    if (format === "XLSX") {
      return type === "summary"
        ? this.excelGenerator.generateSummary(data as SummaryReportData)
        : this.excelGenerator.generateAppraisal(data as AppraisalReportData);
    }
    if (format === "PDF") {
      return type === "summary"
        ? this.pdfGenerator.generateSummary(data as SummaryReportData)
        : this.pdfGenerator.generateAppraisal(data as AppraisalReportData);
    }
    return type === "summary"
      ? this.wordGenerator.generateSummary(data as SummaryReportData)
      : this.wordGenerator.generateAppraisal(data as AppraisalReportData);
  }

  private async findRecordOrThrow(id: string) {
    const record = await this.prisma.reportExport.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: "Không tìm thấy lịch sử xuất báo cáo",
      });
    }
    return record;
  }

  private toMetadata(record: {
    id: string;
    periodId: string;
    evaluationId: string | null;
    reportType: string;
    format: string;
    fileName: string | null;
    sizeBytes: bigint | null;
    createdById: string;
    createdAt: Date;
  }) {
    return {
      id: record.id,
      periodId: record.periodId,
      evaluationId: record.evaluationId,
      reportType: record.reportType,
      format: record.format,
      fileName: record.fileName,
      sizeBytes: record.sizeBytes === null ? null : Number(record.sizeBytes),
      createdById: record.createdById,
      createdAt: record.createdAt,
    };
  }

  private getStorageRoot(): string {
    const configured = this.configService.get<string>("REPORT_EXPORT_DIR")
      ?? "./storage/report-exports";
    return isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
  }

  private resolveStoragePath(storagePath: string): string {
    const root = this.getStorageRoot();
    const target = resolve(root, storagePath);
    const fromRoot = relative(root, target);
    if (
      fromRoot === "" ||
      fromRoot === ".." ||
      fromRoot.startsWith(`..${sep}`) ||
      isAbsolute(fromRoot)
    ) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: "Đường dẫn tệp báo cáo không hợp lệ",
      });
    }
    return target;
  }

  private buildFileName(
    reportType: string,
    year: number,
    extension: string,
  ): string {
    const prefix = reportType === "SUMMARY_ALL_UNITS"
      ? "summary-all-units"
      : "unit-appraisal-minutes";
    return `${prefix}-${year}.${extension}`;
  }

  private getContentType(format: ReportFormat): string {
    const contentTypes: Record<ReportFormat, string> = {
      XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      PDF: "application/pdf",
      DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return contentTypes[format];
  }
}
