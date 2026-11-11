import type { ErrorCode } from "../constants/error-codes.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";

export type ErrorDetail = { field: string; messages: string[] };
export type ApiError = { statusCode: number; code: ErrorCode; message: string; details: ErrorDetail[] };

/** Tạo đủ bốn trường giao ước từ mã nội bộ, không nhận thông điệp thô của DB hay nhà cung cấp */
export function apiError(statusCode: number, code: ErrorCode, details: ErrorDetail[] = []): ApiError {
  return { statusCode, code, message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR, details };
}

/** Chỉ nhận object để đọc metadata có kiểm soát, loại null và mảng để tránh hiểu sai cấu trúc lỗi */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
