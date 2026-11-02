import type { PaginationQueryDto } from "../dto/pagination-query.dto.js";

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginationOptions {
  skip: number;
  take: number;
  orderBy: Array<Record<string, "asc" | "desc">>;
}

export function buildPaginationOptions(
  query: PaginationQueryDto,
  allowedSortFields: string[],
  defaultSortField = "createdAt",
): PaginationOptions {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  // Chỉ chấp nhận trường sắp xếp được dịch vụ cho phép
  const sortField = query.sortBy && allowedSortFields.includes(query.sortBy)
    ? query.sortBy
    : defaultSortField;

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  // Dùng mã định danh làm khóa phụ để các trang có thứ tự ổn định khi giá trị sắp xếp trùng nhau
    orderBy: [{ [sortField]: query.sortOrder ?? "desc" }, { id: "asc" }],
  };
}

export function createPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return { items, page, pageSize, total };
}
