import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ERROR_CODES, type ErrorCode } from "../constants/error-codes.js";

type ErrorDetail = { field: string; messages: string[] };
type ErrorResponse = {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
};
type UnknownRecord = Record<string, unknown>;
type HttpResponse = { status(code: number): HttpResponse; json(body: ErrorResponse): void };
type HttpRequest = { method: string; url: string };

/** Chuẩn hóa mọi ngoại lệ thành một định dạng phản hồi API thống nhất */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponse>();
    const request = context.getRequest<HttpRequest>();
    const prismaError = this.getPrismaError(exception);

    if (prismaError) {
      response.status(prismaError.statusCode).json(prismaError);
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const errorBody = this.asRecord(payload);
      const validationDetails = statusCode === HttpStatus.BAD_REQUEST
        ? this.getValidationDetails(errorBody?.message)
        : undefined;
      const message = validationDetails
        ? "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập"
        : this.getHttpMessage(statusCode, errorBody?.message);
      const body: ErrorResponse = {
        statusCode,
        code: this.getHttpCode(statusCode, errorBody?.code),
        message,
        ...(validationDetails ? { details: validationDetails } : errorBody?.details !== undefined ? { details: errorBody.details } : {}),
      };
      response.status(statusCode).json(body);
      return;
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`Unhandled exception for ${request.method} ${request.url}`, error.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Lỗi hệ thống nội bộ",
    } satisfies ErrorResponse);
  }

  private getPrismaError(exception: unknown): ErrorResponse | undefined {
    const error = this.asRecord(exception);
    if (!error || typeof error.code !== "string") return undefined;

    if (error.code === "P2002") {
      const target = this.getUniqueTarget(error.meta);
      const modelName = this.asRecord(error.meta)?.modelName;
      const code = target.includes("username")
        ? ERROR_CODES.USERNAME_TAKEN
        : target.includes("unitcode") || (target === "code" && modelName === "Unit")
          ? ERROR_CODES.UNIT_CODE_TAKEN
          : ERROR_CODES.CONFLICT;
      const messages: Record<string, string> = {
        [ERROR_CODES.USERNAME_TAKEN]: "Tên đăng nhập đã được sử dụng",
        [ERROR_CODES.UNIT_CODE_TAKEN]: "Mã đơn vị đã được sử dụng",
        [ERROR_CODES.CONFLICT]: "Dữ liệu bị trùng",
      };
      return { statusCode: HttpStatus.CONFLICT, code, message: messages[code] };
    }

    if (error.code === "P2025") {
      return { statusCode: HttpStatus.NOT_FOUND, code: ERROR_CODES.NOT_FOUND, message: "Không tìm thấy dữ liệu" };
    }

    if (error.code === "P2003") {
      return { statusCode: HttpStatus.CONFLICT, code: ERROR_CODES.REFERENCE_IN_USE, message: "Không thể thực hiện vì dữ liệu đang được tham chiếu" };
    }

    if (error.code === "P2010") {
      const meta = this.asRecord(error.meta);
      const databaseCode = typeof meta?.code === "string" ? meta.code : "";
      const message = this.extractDatabaseMessage(meta?.message) ?? "Quy tắc dữ liệu không cho phép thao tác này";
      const statusCode = databaseCode.startsWith("23") ? HttpStatus.CONFLICT : HttpStatus.UNPROCESSABLE_ENTITY;
      return { statusCode, code: ERROR_CODES.DB_RULE_VIOLATION, message };
    }

    return undefined;
  }

  private getValidationDetails(value: unknown): ErrorDetail[] | undefined {
    if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string")) {
      return undefined;
    }

    const details = new Map<string, string[]>();
    for (const item of value) {
      const match = item.match(/^([\w.]+):\s*(.+)$/);
      const field = match?.[1] ?? "request";
      const message = match?.[2] ?? item;
      const messages = details.get(field) ?? [];
      messages.push(message);
      details.set(field, messages);
    }
    return [...details].map(([field, messages]) => ({ field, messages }));
  }

  private getHttpMessage(statusCode: number, value: unknown): string {
    const message = typeof value === "string"
      ? value
      : Array.isArray(value) && value.every((item) => typeof item === "string")
        ? value.join("; ")
        : undefined;
    if (message) return message;

    const defaults: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: "Yêu cầu không hợp lệ",
      [HttpStatus.UNAUTHORIZED]: "Bạn cần đăng nhập để thực hiện thao tác này",
      [HttpStatus.FORBIDDEN]: "Bạn không có quyền thực hiện thao tác này",
      [HttpStatus.NOT_FOUND]: "Không tìm thấy dữ liệu",
      [HttpStatus.CONFLICT]: "Dữ liệu bị xung đột",
      [HttpStatus.UNPROCESSABLE_ENTITY]: "Dữ liệu không thể xử lý",
    };
    return defaults[statusCode] ?? "Đã xảy ra lỗi khi xử lý yêu cầu";
  }

  private getHttpCode(statusCode: number, customCode: unknown): ErrorCode {
    if (typeof customCode === "string") return customCode;
    const codes: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION_ERROR,
      [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.BUSINESS_RULE_VIOLATION,
    };
    return codes[statusCode] ?? ERROR_CODES.INTERNAL_ERROR;
  }

  private getUniqueTarget(meta: unknown): string {
    const target = this.asRecord(meta)?.target;
    return (Array.isArray(target) ? target.join(" ") : typeof target === "string" ? target : "").toLowerCase().replace(/[_\s]/g, "");
  }

  private extractDatabaseMessage(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const match = value.match(/(?:ERROR:\s*)?((?:[\w]+:\s*)?[^\n]+?)(?:\s+at\s+PL\/pgSQL|\n|$)/i);
    const message = match?.[1]?.trim();
    return message && !/^PL\/pgSQL/i.test(message) ? message : undefined;
  }

  private asRecord(value: unknown): UnknownRecord | undefined {
    return typeof value === "object" && value !== null ? value as UnknownRecord : undefined;
  }
}
