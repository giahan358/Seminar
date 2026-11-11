import { ERROR_CODES, type ErrorCode } from "./error-codes.js";

/** Danh mục câu hiển thị công khai theo mã ổn định, không chứa dữ liệu từ exception hoặc provider */
export const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Dữ liệu gửi lên không hợp lệ.",
  CONFLICT: "Dữ liệu bị trùng hoặc xung đột với trạng thái hiện tại.",
  USERNAME_TAKEN: "Tên đăng nhập đã được sử dụng.",
  UNIT_CODE_TAKEN: "Mã đơn vị đã được sử dụng.",
  NOT_FOUND: "Không tìm thấy tài nguyên được yêu cầu.",
  USER_NOT_FOUND: "Không tìm thấy tài khoản.",
  UNIT_NOT_FOUND: "Không tìm thấy đơn vị.",
  UNIT_ACCOUNT_EXISTS: "Đơn vị đã có tài khoản sử dụng.",
  REFERENCE_IN_USE: "Không thể thực hiện vì dữ liệu đang được tham chiếu.",
  DB_RULE_VIOLATION: "Dữ liệu không đáp ứng quy tắc của hệ thống.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  UNAUTHORIZED: "Bạn cần đăng nhập để thực hiện thao tác này.",
  INVALID_CREDENTIALS: "Tên đăng nhập hoặc mật khẩu không chính xác.",
  INVALID_REFRESH_TOKEN: "Phiên làm việc không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
  PASSWORD_CHANGE_REQUIRED: "Bạn cần đổi mật khẩu trước khi sử dụng chức năng này.",
  BUSINESS_RULE_VIOLATION: "Trạng thái hiện tại không cho phép thực hiện thao tác này.",
  METHOD_NOT_ALLOWED: "Phương thức yêu cầu không được hỗ trợ.",
  PAYLOAD_TOO_LARGE: "Dữ liệu hoặc tệp gửi lên vượt dung lượng cho phép.",
  UNSUPPORTED_MEDIA_TYPE: "Định dạng nội dung gửi lên không được hỗ trợ.",
  SERVICE_UNAVAILABLE: "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.",
  DATABASE_UNAVAILABLE: "Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.",
  INTERNAL_ERROR: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
};

/** Chọn mã theo HTTP khi framework không cấp mã nghiệp vụ, giữ nguyên status thay vì gom về 400 */
export function codeForStatus(status: number): ErrorCode {
  const codes: Record<number, ErrorCode> = {
    400: ERROR_CODES.VALIDATION_ERROR, 401: ERROR_CODES.UNAUTHORIZED,
    403: ERROR_CODES.FORBIDDEN, 404: ERROR_CODES.NOT_FOUND,
    405: ERROR_CODES.METHOD_NOT_ALLOWED, 409: ERROR_CODES.CONFLICT,
    413: ERROR_CODES.PAYLOAD_TOO_LARGE, 415: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
    422: ERROR_CODES.BUSINESS_RULE_VIOLATION, 503: ERROR_CODES.SERVICE_UNAVAILABLE,
  };
  return codes[status] ?? ERROR_CODES.INTERNAL_ERROR;
}
