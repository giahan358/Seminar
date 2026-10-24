import assert from "node:assert/strict";
import { test } from "node:test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

test("API serves Swagger documentation over HTTP", async () => {
  const response = await fetch(`${baseUrl}/api/docs-json`);

  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.info.title, "Seminar Evaluation API");
});

test("login rejects requests without credentials", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
});
