import { beforeEach, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "../mocks/server";
import apiClient from "./apiClient";
import { getAccessToken, setSession } from "./session";

/** Mỗi test bắt đầu từ phiên hết hạn độc lập để không dùng token được xoay từ test trước */
beforeEach(() => {
  sessionStorage.clear();
  setSession({ accessToken: "cu", refreshToken: "refresh-cu", user: { id: "unit", role: "UNIT" } });
});
/** Hai request 401 cùng lúc chỉ xoay một lần, retry dùng token mới và trả dữ liệu nghiệp vụ */
it("gộp refresh và retry một lần cho các request cạnh tranh", async () => {
  let refreshCount = 0;
  server.use(http.get("*/api/v1/vc02-test", ({ request }) => request.headers.get("authorization") === "Bearer moi" ? HttpResponse.json({ success: true }) : HttpResponse.json({ code: "UNAUTHORIZED" }, { status: 401 })),
    http.post("*/api/v1/auth/refresh", async () => { refreshCount++; await delay(50); return HttpResponse.json({ accessToken: "moi", refreshToken: "refresh-moi", user: { id: "unit", role: "UNIT" } }); }));
  const results = await Promise.all([apiClient.get("/vc02-test"), apiClient.get("/vc02-test")]);
  expect(results).toEqual([{ success: true }, { success: true }]); expect(refreshCount).toBe(1); expect(getAccessToken()).toBe("moi");
});
/** Refresh lỗi xóa phiên và dừng, endpoint Auth không tự refresh để tránh vòng lặp khi credential sai */
it("refresh thất bại xóa phiên và không lặp interceptor", async () => {
  let calls = 0;
  server.use(http.get("*/api/v1/vc02-test", () => HttpResponse.json({}, { status: 401 })),
    http.post("*/api/v1/auth/refresh", () => { calls++; return HttpResponse.json({ code: "INVALID_REFRESH_TOKEN" }, { status: 401 }); }));
  await expect(apiClient.get("/vc02-test")).rejects.toMatchObject({ status: 401 });
  expect(getAccessToken()).toBeNull(); expect(calls).toBe(1);
});
/** API vẫn 401 sau xoay phải dừng ở retry thứ nhất và xóa token mới, không bắn refresh liên tục */
it("retry vẫn 401 thì kết thúc phiên", async () => {
  let refreshCount = 0; let requests = 0;
  server.use(http.get("*/api/v1/vc02-test", () => { requests++; return HttpResponse.json({}, { status: 401 }); }),
    http.post("*/api/v1/auth/refresh", () => { refreshCount++; return HttpResponse.json({ accessToken: "moi", refreshToken: "r-moi", user: { id: "unit" } }); }));
  await expect(apiClient.get("/vc02-test")).rejects.toBeDefined();
  expect(requests).toBe(2); expect(refreshCount).toBe(1); expect(getAccessToken()).toBeNull();
});

/** Thiếu refresh phải kết thúc flight trong microtask, lần đăng nhập sau vẫn có thể làm mới thay vì giữ promise lỗi cũ */
it("thiếu refresh không làm kẹt lần đăng nhập kế tiếp", async () => {
  sessionStorage.clear();
  server.use(http.get("*/api/v1/vc02-test", ({ request }) => request.headers.get("authorization") === "Bearer moi" ? HttpResponse.json({ success: true }) : HttpResponse.json({}, { status: 401 })),
    http.post("*/api/v1/auth/refresh", () => HttpResponse.json({ accessToken: "moi", refreshToken: "r-moi", user: { id: "unit" } })));
  await expect(apiClient.get("/vc02-test")).rejects.toBeDefined();
  setSession({ accessToken: "cu", refreshToken: "r-cu", user: { id: "unit" } });
  await expect(apiClient.get("/vc02-test")).resolves.toEqual({ success: true });
});
