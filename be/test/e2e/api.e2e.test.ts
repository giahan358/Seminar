import assert from "node:assert/strict";
import { test } from "node:test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

/** Xác nhận máy chủ cung cấp tài liệu Swagger qua HTTP */
test("API cung cấp tài liệu Swagger qua HTTP", async () => {
  const response = await fetch(`${baseUrl}/api/docs-json`);

  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.info.title, "Seminar Evaluation API");
});

/** Xác nhận API đăng nhập từ chối yêu cầu không có thông tin xác thực */
test("đăng nhập từ chối yêu cầu không có thông tin xác thực", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
});
