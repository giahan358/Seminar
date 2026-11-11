import { describe, expect, it } from "vitest";
import { normalizeApiError } from "./apiError";

describe("Chuẩn hóa lỗi API tiếng Việt", () => {
  /** Lỗi server lạ có HTML/SQL/credential phải thành câu nội bộ, không giữ cause Axios vốn chứa request nhạy cảm */
  it("bỏ raw response và dữ liệu bí mật", () => {
    const safe = normalizeApiError({ response: { status: 500, data: { message: "SELECT SECRET_PASSWORD FROM users", details: ["secret"] } }, config: { password: "SECRET_PASSWORD" } });
    expect(safe.message).toBe("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
    expect(safe.fieldErrors).toEqual([]);
    expect(safe).not.toHaveProperty("cause");
    expect(JSON.stringify(safe)).not.toContain("SECRET_PASSWORD");
  });

  /** Giữ code/field và danh sách messages đã dịch để UI gắn lỗi đúng trường lồng nhau, bỏ câu validator tiếng Anh */
  it("giữ giao ước messages và đường dẫn mảng", () => {
    const safe = normalizeApiError({ response: { status: 400, data: { code: "VALIDATION_ERROR", message: "raw secret", details: [
      { field: "scores.0.score", messages: ["Điểm không được âm.", "must be positive"] },
    ] } } });
    expect(safe.fieldErrors).toEqual([{ field: "scores.0.score", messages: ["Điểm không được âm."] }]);
    expect(safe.message).toBe("Dữ liệu gửi lên không hợp lệ.");
  });

  /** Timeout cần hướng dẫn thử lại còn mất mạng cần kiểm kết nối, cả hai không dùng message mặc định của Axios/browser */
  it("phân biệt timeout và mất mạng", () => {
    expect(normalizeApiError({ code: "ECONNABORTED", message: "timeout exceeded" }).message).toContain("quá thời gian chờ");
    expect(normalizeApiError({ message: "Network Error" }).message).toContain("Không thể kết nối máy chủ");
    expect(normalizeApiError({ response: { status: 403 } }).message).toContain("không có quyền");
  });
});
