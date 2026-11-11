import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { Prisma } from "../../generated/prisma/client.js";
import { toApiNumber } from "../utils/decimal.util.js";

/** Đổi kiểu DB sang JSON trước khi Decimal tự toJSON thành chuỗi, giữ BigInt lớn dưới dạng chuỗi để tránh mất số */
export function serializeApiValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return toApiNumber(value);
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(value) : value.toString();
  }
  if (Array.isArray(value)) return value.map(serializeApiValue);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeApiValue(item)]));
  }
  // Buffer, StreamableFile và các instance đặc biệt phải giữ nguyên để adapter còn xử lý tải tệp đúng cách
  return value;
}

@Injectable()
export class ApiSerializationInterceptor implements NestInterceptor {
  /** Chỉ biến đổi kết quả thành công, để ngoại lệ đi tới filter và không nuốt lỗi hoặc biến lỗi thành dữ liệu */
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(serializeApiValue));
  }
}
