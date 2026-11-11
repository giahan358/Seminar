import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import PDFDocument from "pdfkit";
import type {
  AppraisalReportData,
  GeneratedReport,
  SummaryReportData,
} from "./report-data.js";
import { PassThrough } from "node:stream";

const PDF_CONTENT_TYPE = "application/pdf";

@Injectable()
export class PdfReportGenerator {
  constructor(private readonly configService: ConfigService) {}

  async generateSummary(data: SummaryReportData): Promise<GeneratedReport> {
    const doc = this.createDocument();
    const chunks: Buffer[] = [];
    const output = new PassThrough();
    doc.pipe(output);
    output.on("data", (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(16).text("BÁO CÁO TỔNG HỢP TOÀN BỘ ĐƠN VỊ", {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(11).text(`Kỳ đánh giá: ${data.period.name}`);
    doc.text(`Năm: ${data.period.year}`);
    doc.text(`Giai đoạn: ${data.period.phase}`);
    doc.text(`Điểm tối đa: ${data.period.maxTotalScore}`);
    doc.moveDown();

    this.writeTableHeader(doc, [
      "Mã đơn vị",
      "Tên đơn vị",
      "Trạng thái",
      "Điểm",
      "Tỷ lệ",
      "Xếp loại",
    ]);
    for (const row of data.rows) {
      this.ensureSpace(doc, 42);
      doc.fontSize(8).text(
        `${row.unitCode} | ${row.unitName} | ${row.evaluationStatus} | ${row.finalScore ?? "-"} | ${row.finalPercent ?? "-"}% | ${row.finalRating ?? "-"}`,
      );
    }

    const finished = this.waitForFinish(output);
    doc.end();
    await finished;
    return {
      buffer: Buffer.concat(chunks),
      contentType: PDF_CONTENT_TYPE,
      extension: "pdf",
    };
  }

  async generateAppraisal(data: AppraisalReportData): Promise<GeneratedReport> {
    const doc = this.createDocument();
    const chunks: Buffer[] = [];
    const output = new PassThrough();
    doc.pipe(output);
    output.on("data", (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(16).text("BIÊN BẢN ĐÁNH GIÁ ĐƠN VỊ", { align: "center" });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Kỳ đánh giá: ${data.period.name} (${data.period.year})`);
    doc.text(`Đơn vị: ${data.unit.code} - ${data.unit.name}`);
    doc.text(`Trạng thái: ${data.evaluation.status}`);
    doc.text(`Ngày nộp: ${this.formatDate(data.evaluation.submittedAt)}`);
    doc.text(`Ngày chốt: ${this.formatDate(data.evaluation.finalizedAt)}`);
    doc.text(`Tổng điểm: ${data.evaluation.finalScore ?? "-"}`);
    doc.text(`Tỷ lệ: ${data.evaluation.finalPercent ?? "-"}%`);
    doc.text(`Xếp loại: ${data.evaluation.finalRating ?? "-"}`);
    doc.moveDown();

    doc.fontSize(12).text("CHI TIẾT TIÊU CHÍ", { underline: true });
    for (const score of data.scores) {
      this.ensureSpace(doc, 70);
      doc.fontSize(9).text(`${score.code} - ${score.name}`);
      doc.fontSize(8).text(
        `Tối đa: ${score.maxScore} | Tự đánh giá: ${score.selfScore ?? "-"} | Admin: ${score.adminScore ?? "-"} | Điểm hiện tại: ${score.currentScore ?? "-"}`,
      );
      if (score.selfNote) doc.text(`Ghi chú: ${score.selfNote}`);
      if (score.adminComment) doc.text(`Nhận xét Admin: ${score.adminComment}`);
      doc.moveDown(0.5);
    }

    if (data.feedbacks.length > 0) {
      doc.addPage();
      doc.fontSize(12).text("NHẬN XÉT / PHẢN HỒI", { underline: true });
      for (const feedback of data.feedbacks) {
        this.ensureSpace(doc, 55);
        doc.fontSize(9).text(
          `${feedback.type} - ${feedback.authorName} - ${this.formatDate(feedback.createdAt)}`,
        );
        doc.fontSize(9).text(feedback.content);
        doc.moveDown();
      }
    }

    const finished = this.waitForFinish(output);
    doc.end();
    await finished;
    return {
      buffer: Buffer.concat(chunks),
      contentType: PDF_CONTENT_TYPE,
      extension: "pdf",
    };
  }

  private createDocument(): PDFKit.PDFDocument {
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: { Title: "Seminar KPI Report", Author: "Seminar KPI" },
    });
    const fontPath = this.configService.get<string>("REPORT_PDF_FONT_PATH");
    if (fontPath) {
      doc.font(fontPath);
    }
    return doc;
  }

  private writeTableHeader(
    doc: PDFKit.PDFDocument,
    columns: string[],
  ): void {
    doc.fontSize(9).text(columns.join(" | "), { underline: true });
    doc.moveDown(0.5);
  }

  private ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  private formatDate(value: Date | null): string {
    return value ? value.toLocaleString("vi-VN") : "-";
  }

  private waitForFinish(output: PassThrough): Promise<void> {
    return new Promise((resolve, reject) => {
      output.on("end", resolve);
      output.on("error", reject);
    });
  }
}
