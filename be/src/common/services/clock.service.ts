import { Injectable } from "@nestjs/common";

@Injectable()
export class ClockService {
  private fixedTime?: Date;

  /** Trả bản sao thời điểm hiện tại hoặc mốc test đã đặt, caller không thể sửa ngược trạng thái đồng hồ */
  now(): Date {
    return new Date(this.fixedTime ?? Date.now());
  }

  /** Đặt mốc test bằng Date/epoch/ISO có múi giờ; từ chối ngày sai hoặc chuỗi mơ hồ trước khi ảnh hưởng deadline */
  set(time: Date | string | number): void {
    const parsed = new Date(time);
    if (!Number.isFinite(parsed.getTime()) || (typeof time === "string" && !/(Z|[+-]\d{2}:\d{2})$/i.test(time))) {
      throw new Error("Thời điểm cấu hình đồng hồ không hợp lệ hoặc thiếu múi giờ.");
    }
    this.fixedTime = parsed;
  }

  /** Xóa mốc test để các lần đọc tiếp theo dùng giờ server, không thay đổi timezone hay dữ liệu DB */
  reset(): void {
    this.fixedTime = undefined;
  }
}
