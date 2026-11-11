/** Câu hiển thị theo mã ổn định, không dùng nguyên message/HTML/provider response hoặc lỗi trình duyệt */
const messages = {
  VALIDATION_ERROR: "Dữ liệu gửi lên không hợp lệ.",
  INVALID_CREDENTIALS: "Tên đăng nhập hoặc mật khẩu không chính xác.",
  INVALID_REFRESH_TOKEN: "Phiên làm việc không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
  PASSWORD_CHANGE_REQUIRED: "Bạn cần đổi mật khẩu trước khi sử dụng chức năng này.",
  UNAUTHORIZED: "Bạn cần đăng nhập để thực hiện thao tác này.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy tài nguyên được yêu cầu.",
  USER_NOT_FOUND: "Không tìm thấy tài khoản.",
  UNIT_NOT_FOUND: "Không tìm thấy đơn vị.",
  USERNAME_TAKEN: "Tên đăng nhập đã được sử dụng.",
  UNIT_CODE_TAKEN: "Mã đơn vị đã được sử dụng.",
  UNIT_ACCOUNT_EXISTS: "Đơn vị đã có tài khoản sử dụng.",
  CONFLICT: "Dữ liệu bị trùng hoặc xung đột với trạng thái hiện tại.",
  REFERENCE_IN_USE: "Không thể thực hiện vì dữ liệu đang được tham chiếu.",
  DB_RULE_VIOLATION: "Dữ liệu không đáp ứng quy tắc của hệ thống.",
  BUSINESS_RULE_VIOLATION: "Trạng thái hiện tại không cho phép thực hiện thao tác này.",
  METHOD_NOT_ALLOWED: "Phương thức yêu cầu không được hỗ trợ.",
  PAYLOAD_TOO_LARGE: "Dữ liệu hoặc tệp gửi lên vượt dung lượng cho phép.",
  UNSUPPORTED_MEDIA_TYPE: "Định dạng nội dung gửi lên không được hỗ trợ.",
  DATABASE_UNAVAILABLE: "Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.",
  SERVICE_UNAVAILABLE: "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.",
  INTERNAL_ERROR: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
};

/** Nhận lỗi Axios/fetch và chỉ xuất trạng thái, mã, câu tiếng Việt cùng lỗi trường theo giao ước, không giữ cause chứa credential */
export function normalizeApiError(error) {
  const status = error?.response?.status;
  const payload = error?.response?.data;
  const code = Object.hasOwn(messages, payload?.code) ? payload.code : null;
  const fallback = {
    400: messages.VALIDATION_ERROR, 401: messages.UNAUTHORIZED, 403: messages.FORBIDDEN,
    404: messages.NOT_FOUND, 405: messages.METHOD_NOT_ALLOWED, 409: messages.CONFLICT,
    413: messages.PAYLOAD_TOO_LARGE, 415: messages.UNSUPPORTED_MEDIA_TYPE,
    422: messages.BUSINESS_RULE_VIOLATION, 503: messages.SERVICE_UNAVAILABLE,
  };
  const fieldErrors = code && Array.isArray(payload?.details) ? payload.details.flatMap((detail) => {
    if (typeof detail?.field !== "string" || !/^[\w.]+$/.test(detail.field)) return [];
    // Chi tiết chỉ nhận từ backend theo mã đã biết, bỏ câu mặc định tiếng Anh và mọi giá trị ngoài cấu trúc
    const values = Array.isArray(detail.messages) ? detail.messages.filter((value) => typeof value === "string" && /[À-ỹĐđ]/u.test(value)) : [];
    return [{ field: detail.field, messages: values.length ? values : [messages.VALIDATION_ERROR] }];
  }) : [];
  return {
    status, code,
    message: code ? messages[code] : status ? fallback[status] ?? messages.INTERNAL_ERROR
      : error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT"
        ? "Yêu cầu quá thời gian chờ. Vui lòng thử lại."
        : "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.",
    fieldErrors,
  };
}

/** Gắn messages vào đúng trường Ant Design đang hiển thị, đổi chỉ số mảng thành số và bỏ field ngoài form để tránh lỗi vô hình */
export function applyApiFieldErrors(form, error, allowedFields) {
  const details = Array.isArray(error?.fieldErrors) ? error.fieldErrors : [];
  const fields = details.filter((detail) => typeof detail?.field === "string"
    && allowedFields.includes(detail.field.split(".")[0]) && Array.isArray(detail.messages)).map((detail) => ({
    name: detail.field.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part),
    errors: detail.messages,
  }));
  if (fields.length) form.setFields(fields);
}
