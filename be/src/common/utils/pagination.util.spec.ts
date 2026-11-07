import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PaginationQueryDto } from "../dto/pagination-query.dto.js";
import { buildPaginationOptions, createPaginatedResult } from "./pagination.util.js";

/** Xác nhận DTO phân trang tự điền các giá trị mặc định */
test("DTO phân trang điền các giá trị mặc định", () => {
  const query = plainToInstance(PaginationQueryDto, {});
  assert.equal(query.page, 1);
  assert.equal(query.pageSize, 20);
  assert.equal(query.sortOrder, "desc");
});

/** Xác nhận DTO từ chối kích thước trang quá lớn và số trang không hợp lệ */
test("DTO phân trang từ chối kích thước quá 100 và số trang nhỏ hơn 1", async () => {
  const tooMany = plainToInstance(PaginationQueryDto, { pageSize: "101" });
  const invalidPage = plainToInstance(PaginationQueryDto, { page: "0" });
  assert.ok((await validate(tooMany)).some((error) => error.property === "pageSize"));
  assert.ok((await validate(invalidPage)).some((error) => error.property === "page"));
});

/** Xác nhận tùy chọn sắp xếp chỉ nhận trường cho phép và thêm khóa phụ ổn định */
test("tùy chọn phân trang chỉ nhận trường sắp xếp cho phép và thêm khóa phụ", () => {
  const allowed = buildPaginationOptions(
    plainToInstance(PaginationQueryDto, { page: "3", pageSize: "10", sortBy: "name", sortOrder: "asc" }),
    ["name", "createdAt"],
  );
  assert.deepEqual(allowed, { skip: 20, take: 10, orderBy: [{ name: "asc" }, { id: "asc" }] });

  const rejected = buildPaginationOptions(
    plainToInstance(PaginationQueryDto, { sortBy: "passwordHash" }),
    ["name"],
  );
  assert.deepEqual(rejected.orderBy, [{ createdAt: "desc" }, { id: "asc" }]);
});

/** Xác nhận kết quả phân trang có cấu trúc phản hồi thống nhất */
test("kết quả phân trang trả về cấu trúc phản hồi chuẩn", () => {
  const items = [{ id: "one" }];
  assert.deepEqual(createPaginatedResult(items, 7, 2, 5), { items, page: 2, pageSize: 5, total: 7 });
});
