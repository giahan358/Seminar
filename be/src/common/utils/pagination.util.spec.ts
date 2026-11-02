import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PaginationQueryDto } from "../dto/pagination-query.dto.js";
import { buildPaginationOptions, createPaginatedResult } from "./pagination.util.js";

test("pagination DTO supplies standard defaults", () => {
  const query = plainToInstance(PaginationQueryDto, {});
  assert.equal(query.page, 1);
  assert.equal(query.pageSize, 20);
  assert.equal(query.sortOrder, "desc");
});

test("pagination DTO rejects page sizes above 100 and pages below 1", async () => {
  const tooMany = plainToInstance(PaginationQueryDto, { pageSize: "101" });
  const invalidPage = plainToInstance(PaginationQueryDto, { page: "0" });
  assert.ok((await validate(tooMany)).some((error) => error.property === "pageSize"));
  assert.ok((await validate(invalidPage)).some((error) => error.property === "page"));
});

test("pagination options whitelist sorting and always add an id tie-breaker", () => {
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

test("createPaginatedResult returns the standardized response shape", () => {
  const items = [{ id: "one" }];
  assert.deepEqual(createPaginatedResult(items, 7, 2, 5), { items, page: 2, pageSize: 5, total: 7 });
});
