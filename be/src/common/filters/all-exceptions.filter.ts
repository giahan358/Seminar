import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { ERROR_CODES } from "../constants/error-codes.js";
import { codeForStatus, ERROR_MESSAGES } from "../constants/error-messages.js";
import { apiError, asRecord, type ApiError, type ErrorDetail } from "../utils/api-error.util.js";

/** Ánh xạ mã Prisma/SQLSTATE đã biết, tuyệt đối không lấy exception.message hay SQL làm câu hiển thị */
export function databaseError(exception: unknown): ApiError | undefined {
  const error = asRecord(exception);
  if (!error) return undefined;
  const meta = asRecord(error.meta);
  const adapter = asRecord(meta?.driverAdapterError);
  const cause = asRecord(adapter?.cause) ?? asRecord(asRecord(error.cause)?.cause) ?? asRecord(error.cause);
  const sqlState = meta?.code ?? cause?.originalCode ?? error.code;
  const code = error.code;
  if (code === "P2002" || sqlState === "23505") {
    const constraint = asRecord(cause?.constraint);
    const target = JSON.stringify(meta?.target ?? constraint?.fields ?? constraint?.index ?? "").toLowerCase();
    const uniqueCode = /username/.test(target) ? ERROR_CODES.USERNAME_TAKEN
      : /units.*code|unit.*code/.test(target) || (meta?.modelName === "Unit" && /code/.test(target))
        ? ERROR_CODES.UNIT_CODE_TAKEN : ERROR_CODES.CONFLICT;
    return apiError(409, uniqueCode);
  }
  if (code === "P2025") return apiError(404, ERROR_CODES.NOT_FOUND);
  if (code === "P2003" || sqlState === "23503") return apiError(409, ERROR_CODES.REFERENCE_IN_USE);
  if (code === "P2034" || sqlState === "40001" || sqlState === "40P01") return apiError(409, ERROR_CODES.CONFLICT);
  if (["23514", "23502", "P0001"].includes(String(sqlState)) || code === "P2004" || code === "P2011") {
    return apiError(422, ERROR_CODES.DB_RULE_VIOLATION);
  }
  if (["P1000", "P1001", "P1002", "P1008", "P1017", "P2024", "ECONNREFUSED"].includes(String(code))
    || String(sqlState).startsWith("08") || sqlState === "57P01") {
    return apiError(503, ERROR_CODES.DATABASE_UNAVAILABLE);
  }
  // SQL sai hoặc mã Prisma chưa biết là lỗi nội bộ, không biến thành lỗi dữ liệu của người dùng
  if (/^P\d{4}$/.test(String(code)) || adapter || error.name === "PrismaClientValidationError") {
    return apiError(500, ERROR_CODES.INTERNAL_ERROR);
  }
  return undefined;
}

/** Lọc details do ứng dụng tạo, bỏ trường lạ và câu mặc định tiếng Anh mà không phản chiếu giá trị nhập */
function safeDetails(value: unknown): ErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const detail = asRecord(item);
    if (typeof detail?.field !== "string" || !/^[\w.]+$/.test(detail.field)) return [];
    const messages = Array.isArray(detail.messages) ? detail.messages.filter((message): message is string =>
      typeof message === "string" && /[À-ỹĐđ]/u.test(message)) : [];
    return [{ field: detail.field, messages: messages.length ? messages : [ERROR_MESSAGES.VALIDATION_ERROR] }];
  });
}

/** Chuẩn hóa lỗi HTTP và DB thành câu tiếng Việt; log chỉ mã và requestId để lỗi nội bộ không làm lộ secret */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /** Đọc ngoại lệ một lần, bảo toàn HTTP có ý nghĩa và luôn trả details kể cả lỗi framework không có DTO */
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    let body = databaseError(exception);
    // Express có lỗi parser mang type/status nhưng không kế thừa HttpException, chỉ nhận các type đã biết để giữ status an toàn
    const parser = asRecord(exception);
    const parserStatuses: Record<string, number> = { "entity.too.large": 413, "entity.parse.failed": 400,
      "encoding.unsupported": 415, "charset.unsupported": 415, "request.aborted": 400, "request.size.invalid": 400 };
    const parserStatus = typeof parser?.type === "string" ? parserStatuses[parser.type] : undefined;
    if (!body && parserStatus) body = apiError(parserStatus, codeForStatus(parserStatus));
    // Busboy có nhánh lỗi multipart không mang status, nhận đúng câu cố định của thư viện nhưng không trả câu đó ra client
    if (!body && ["Unexpected end of form", "Unexpected end of file", "Multipart: Boundary not found"].includes(String(parser?.message))) {
      body = apiError(400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!body && exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = asRecord(exception.getResponse());
      const custom = payload?.code;
      const knownCode = typeof custom === "string" && Object.hasOwn(ERROR_MESSAGES, custom);
      const code = knownCode ? custom : codeForStatus(status);
      // Chỉ nhận lỗi trường theo mã nội bộ đã công bố, bỏ details của lỗi framework/provider dù câu thô có dấu tiếng Việt
      body = apiError(status, code, status < 500 && knownCode ? safeDetails(payload?.details) : []);
    }
    body ??= apiError(500, ERROR_CODES.INTERNAL_ERROR);
    if (body.statusCode >= 500) {
      this.logger.error(JSON.stringify({ message: "Xử lý yêu cầu thất bại", code: body.code,
        requestId: context.getRequest<{ requestId?: string }>().requestId }));
    }
    context.getResponse<{ status(code: number): { json(body: ApiError): void } }>().status(body.statusCode).json(body);
  }
}
