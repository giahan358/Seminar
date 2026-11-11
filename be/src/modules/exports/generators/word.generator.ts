import { Injectable } from "@nestjs/common";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
} from "docx";
import type {
  AppraisalReportData,
  GeneratedReport,
  SummaryReportData,
} from "./report-data.js";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

@Injectable()
export class WordReportGenerator {
  async generateSummary(data: SummaryReportData): Promise<GeneratedReport> {
    const rows = [
      this.tableRow([
        "Mã đơn vị",
        "Tên đơn vị",
        "Trạng thái",
        "Điểm",
        "Tỷ lệ (%)",
        "Xếp loại",
      ]),
      ...data.rows.map((row) =>
        this.tableRow([
          row.unitCode,
          row.unitName,
          row.evaluationStatus,
          this.value(row.finalScore),
          this.value(row.finalPercent),
          this.value(row.finalRating),
        ]),
      ),
    ];

    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: "BÁO CÁO TỔNG HỢP TOÀN BỘ ĐƠN VỊ",
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph(`Kỳ đánh giá: ${data.period.name}`),
            new Paragraph(`Năm: ${data.period.year}`),
            new Paragraph(`Giai đoạn: ${data.period.phase}`),
            new Paragraph(`Điểm tối đa: ${data.period.maxTotalScore}`),
            new Paragraph(" "),
            new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          ],
        },
      ],
    });

    return this.toGeneratedReport(document);
  }

  async generateAppraisal(data: AppraisalReportData): Promise<GeneratedReport> {
    const scoreRows = [
      this.tableRow([
        "Mã",
        "Tiêu chí",
        "Tối đa",
        "Tự đánh giá",
        "Admin",
        "Điểm hiện tại",
      ]),
      ...data.scores.map((score) =>
        this.tableRow([
          score.code,
          score.name,
          String(score.maxScore),
          this.value(score.selfScore),
          this.value(score.adminScore),
          this.value(score.currentScore),
        ]),
      ),
    ];

    const feedbackParagraphs = data.feedbacks.flatMap((feedback) => [
      new Paragraph({
        text: `${feedback.type} — ${feedback.authorName} — ${feedback.createdAt.toLocaleString("vi-VN")}`,
        heading: HeadingLevel.HEADING_3,
      }),
      new Paragraph(feedback.content),
    ]);

    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: "BIÊN BẢN ĐÁNH GIÁ ĐƠN VỊ",
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph(`Kỳ đánh giá: ${data.period.name} (${data.period.year})`),
            new Paragraph(`Đơn vị: ${data.unit.code} - ${data.unit.name}`),
            new Paragraph(`Trạng thái: ${data.evaluation.status}`),
            new Paragraph(`Ngày nộp: ${this.date(data.evaluation.submittedAt)}`),
            new Paragraph(`Ngày chốt: ${this.date(data.evaluation.finalizedAt)}`),
            new Paragraph(`Tổng điểm cuối cùng: ${this.value(data.evaluation.finalScore)}`),
            new Paragraph(`Tỷ lệ cuối cùng: ${this.value(data.evaluation.finalPercent)}%`),
            new Paragraph(`Xếp loại cuối cùng: ${this.value(data.evaluation.finalRating)}`),
            new Paragraph(" "),
            new Paragraph({
              text: "CHI TIẾT TIÊU CHÍ",
              heading: HeadingLevel.HEADING_1,
            }),
            new Table({
              rows: scoreRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
            new Paragraph(" "),
            new Paragraph({
              text: "NHẬN XÉT / PHẢN HỒI",
              heading: HeadingLevel.HEADING_1,
            }),
            ...(feedbackParagraphs.length
              ? feedbackParagraphs
              : [new Paragraph("Chưa có phản hồi.")]),
          ],
        },
      ],
    });

    return this.toGeneratedReport(document);
  }

  private tableRow(values: string[]): TableRow {
    return new TableRow({
      children: values.map(
        (value) =>
          new TableCell({
            children: [new Paragraph(value)],
          }),
      ),
    });
  }

  private value(value: string | number | null): string {
    return value === null ? "-" : String(value);
  }

  private date(value: Date | null): string {
    return value ? value.toLocaleString("vi-VN") : "-";
  }

  private async toGeneratedReport(document: Document): Promise<GeneratedReport> {
    return {
      buffer: await Packer.toBuffer(document),
      contentType: DOCX_CONTENT_TYPE,
      extension: "docx",
    };
  }
}
