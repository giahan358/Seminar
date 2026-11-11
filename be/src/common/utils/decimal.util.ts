import { Prisma } from "../../generated/prisma/client.js";

/** Đổi điểm sang number hai chữ số theo ROUND_HALF_UP, giữ null để phân biệt chưa chấm với điểm không */
export function toApiNumber(value: Prisma.Decimal | string | number | null): number | null {
  if (value === null) return null;
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/** Tạo Decimal cho phép tính điểm từ giá trị đã validate, tránh cộng trừ trực tiếp bằng số thực nhị phân */
export function decimal(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
