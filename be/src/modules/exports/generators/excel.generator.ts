import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import type {
  AppraisalReportData,
  GeneratedReport,
  SummaryReportData,
} from "./report-data.js";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

@Injectable()
export class ExcelReportGenerator {
  async generateSummary(data: SummaryReportData): Promise<GeneratedReport> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Seminar KPI";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Tong hop don vi");
    sheet.addRows([
      ["BÁO CÁO TỔNG HỢP TOÀN BỘ ĐƠN VỊ"],
      ["Kỳ đánh giá", data.period.name],
      ["Năm", data.period.year],
      ["Giai đoạn", data.period.phase],
      ["Điểm tối đa", data.period.maxTotalScore],
      [],
      [
        "Mã đơn vị",
        "Tên đơn vị",
        "Trạng thái",
        "Ngày nộp",
        "Tổng điểm chính thức",
        "Tỷ lệ (%)",
        "Xếp loại",
      ],
    ]);

    const header = sheet.getRow(7);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };

    for (const row of data.rows) {
      sheet.addRow([
        row.unitCode,
        row.unitName,
        row.evaluationStatus,
        row.submittedAt,
        row.finalScore,
        row.finalPercent,
        row.finalRating,
      ]);
    }

    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 32;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(4).width = 22;
    sheet.getColumn(5).width = 24;
    sheet.getColumn(6).width = 16;
    sheet.getColumn(7).width = 20;
    sheet.getColumn(4).numFmt = "dd/mm/yyyy hh:mm";
    sheet.getColumn(6).numFmt = "0.00";

    return this.toGeneratedReport(workbook, "summary-all-units");
  }

  async generateAppraisal(data: AppraisalReportData): Promise<GeneratedReport> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Seminar KPI";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Bien ban danh gia");
    sheet.addRows([
      ["BIÊN BẢN ĐÁNH GIÁ ĐƠN VỊ"],
      ["Kỳ đánh giá", data.period.name],
      ["Năm", data.period.year],
      ["Đơn vị", `${data.unit.code} - ${data.unit.name}`],
      ["Trạng thái", data.evaluation.status],
      ["Ngày nộp", data.evaluation.submittedAt],
      ["Ngày chốt", data.evaluation.finalizedAt],
      ["Tổng điểm cuối cùng", data.evaluation.finalScore],
      ["Tỷ lệ cuối cùng (%)", data.evaluation.finalPercent],
      ["Xếp loại cuối cùng", data.evaluation.finalRating],
      [],
      [
        "Mã tiêu chí",
        "Tên tiêu chí",
        "Điểm tối đa",
        "Tự đánh giá",
        "Admin đánh giá",
        "Điểm hiện tại",
        "Ghi chú tự đánh giá",
        "Nhận xét Admin",
      ],
    ]);

    const header = sheet.getRow(12);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };

    for (const score of data.scores) {
      sheet.addRow([
        score.code,
        score.name,
        score.maxScore,
        score.selfScore,
        score.adminScore,
        score.currentScore,
        score.selfNote,
        score.adminComment,
      ]);
    }

    const feedbackStart = data.scores.length + 15;
    sheet.getCell(`A${feedbackStart}`).value = "NHẬN XÉT / PHẢN HỒI";
    sheet.getCell(`A${feedbackStart}`).font = { bold: true };
    sheet.addRow(["Loại", "Người nhận xét", "Thời gian", "Nội dung"]);
    for (const feedback of data.feedbacks) {
      sheet.addRow([
        feedback.type,
        feedback.authorName,
        feedback.createdAt,
        feedback.content,
      ]);
    }

    [18, 32, 16, 16, 18, 16, 40, 40].forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    sheet.getColumn(6).numFmt = "0.00";
    sheet.views = [{ state: "frozen", ySplit: 12 }];

    return this.toGeneratedReport(workbook, "unit-appraisal-minutes");
  }

  private async toGeneratedReport(
    workbook: ExcelJS.Workbook,
    _name: string,
  ): Promise<GeneratedReport> {
    const output = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(output),
      contentType: XLSX_CONTENT_TYPE,
      extension: "xlsx",
    };
  }
}
