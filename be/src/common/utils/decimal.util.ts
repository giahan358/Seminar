import { Prisma } from "../../generated/prisma/client.js";

export function toApiNumber(value: Prisma.Decimal | string | number | null): number | null {
  if (value === null) return null;
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

export function decimal(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
