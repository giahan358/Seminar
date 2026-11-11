import { BadRequestException, ValidationPipe, type PipeTransform, type Type } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync, type ValidationError } from "class-validator";
import { apiError, type ErrorDetail } from "../utils/api-error.util.js";
import { ERROR_CODES } from "../constants/error-codes.js";

/** Chuyển cây lỗi DTO thành đường dẫn đầy đủ gồm chỉ số mảng, không đọc value/target chứa dữ liệu bí mật */
export function validationDetails(errors: ValidationError[], prefix = ""): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = [prefix, error.property].filter(Boolean).join(".") || "body";
    const messages = Object.entries(error.constraints ?? {}).map(([rule, message]) => {
      if (rule === "whitelistValidation") return "Trường này không được phép gửi lên.";
      if (rule === "nestedValidation") return "Dữ liệu lồng nhau phải là đối tượng hợp lệ.";
      if (rule === "unknownValue") return "Dữ liệu gửi lên phải đúng cấu trúc yêu cầu.";
      return /[À-ỹĐđ]/u.test(message) ? message : "Giá trị không hợp lệ. Vui lòng kiểm tra lại.";
    });
    return [...(messages.length ? [{ field, messages }] : []), ...validationDetails(error.children ?? [], field)];
  });
}

/** Tạo pipe dùng chung cho ứng dụng và HTTP test, từ chối field lạ thay vì âm thầm bỏ dữ liệu client gửi sai */
export function createApiValidationPipe(expectedType?: Type<unknown>): ValidationPipe {
  return new ValidationPipe({
    expectedType, transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new BadRequestException(apiError(400, ERROR_CODES.VALIDATION_ERROR, validationDetails(errors))),
  });
}

/** Validate mảng body gốc vì TypeScript xóa kiểu phần tử ở runtime, giữ nguyên giao ước mảng của API ngưỡng */
export class ApiArrayValidationPipe<T extends object> implements PipeTransform<unknown, T[]> {
  /** Nhận lớp DTO phần tử; caller truyền trực tiếp để hoạt động cả khi chạy qua tsx không phát metadata */
  constructor(private readonly itemType: Type<T>) {}

  /** Chuyển từng object thành DTO, gom lỗi kèm chỉ số và chặn null/primitive trước khi gọi service ghi transaction */
  transform(value: unknown): T[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException(apiError(400, ERROR_CODES.VALIDATION_ERROR,
        [{ field: "body", messages: ["Dữ liệu gửi lên phải là một mảng."] }]));
    }
    const details: ErrorDetail[] = [];
    const items = value.map((item, index) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        details.push({ field: String(index), messages: ["Mỗi phần tử phải là một đối tượng hợp lệ."] });
        return plainToInstance(this.itemType, {});
      }
      const dto = plainToInstance(this.itemType, item);
      details.push(...validationDetails(validateSync(dto, {
        whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true,
        validationError: { target: false, value: false },
      }), String(index)));
      return dto;
    });
    if (details.length) throw new BadRequestException(apiError(400, ERROR_CODES.VALIDATION_ERROR, details));
    return items;
  }
}
