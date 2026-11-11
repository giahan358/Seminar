import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Playwright được cung cấp từ công cụ kiểm thử riêng, không thêm dependency hoặc mock vào sản phẩm
const modulePath = process.env.VC02_PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error("Cần chỉ định VC02_PLAYWRIGHT_MODULE tới Playwright của môi trường kiểm thử.");
const { chromium } = await import(pathToFileURL(modulePath).href);
const base = process.env.VC02_FE_URL ?? "http://localhost:5176";
const api = process.env.VC02_API_URL ?? "http://localhost:3006";
const username = process.env.VC02_BROWSER_USERNAME ?? "vc02-browser";
const nextPassword = "MatKhauBrowser98";
const browser = await chromium.launch({ executablePath: process.env.VC02_CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage();
const results = [];
let refreshCount = 0;
// Chỉ ghi số lần refresh để kiểm single-flight, không lưu header/body có mật khẩu hoặc token vào báo cáo
page.on("response", response => { if (response.url() === `${api}/api/v1/auth/refresh`) refreshCount++; });
try {
  await page.goto(`${base}/login`);
  await page.getByPlaceholder("Tên đăng nhập").fill(username);
  await page.getByPlaceholder(/^Mật khẩu \(vd:/).fill("123456");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL("**/change-password");
  results.push({ check: "Đăng nhập 123456 buộc đổi mật khẩu", passed: true });
  // Kiểm BE trực tiếp trong browser trước khi đổi để chứng minh route guard FE không phải lớp bảo vệ duy nhất
  const blocked = await page.evaluate(async (apiUrl) => {
    const response = await fetch(`${apiUrl}/api/v1/units`, { headers: { authorization: `Bearer ${sessionStorage.getItem("accessToken")}` } });
    const body = await response.json(); return { status: response.status, code: body.code };
  }, api);
  assert.deepEqual(blocked, { status: 403, code: "PASSWORD_CHANGE_REQUIRED" });
  results.push({ check: "BE chặn nghiệp vụ trước đổi", passed: true });
  await page.getByPlaceholder("Mật khẩu hiện tại").fill("123456");
  await page.getByPlaceholder("Mật khẩu mới", { exact: true }).fill(nextPassword);
  await page.getByPlaceholder("Xác nhận mật khẩu mới").fill(nextPassword);
  await page.getByRole("button", { name: "Xác nhận đổi" }).click();
  await page.waitForURL("**/admin/dashboard");
  // Đi tới trang đơn vị có backend CRUD đã tồn tại, không dùng dashboard chưa có API để tuyên bố chức năng sau Auth hoàn thành
  const unitsResponse = page.waitForResponse(r => r.url().includes("/api/v1/units") && r.status() === 200);
  await page.goto(`${base}/admin/units`); await unitsResponse;
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("currentUser")).mustChangePassword), false);
  results.push({ check: "Đổi mật khẩu và vào trang đơn vị dùng backend thật", passed: true });
  const meResponse = page.waitForResponse(r => r.url().endsWith("/api/v1/auth/me") && r.status() === 200);
  await page.reload(); await meResponse;
  await page.waitForFunction(() => !document.body.innerText.includes("Đang tải"));
  assert.ok(page.url().endsWith("/admin/units"));
  results.push({ check: "Reload phục hồi phiên trong React StrictMode", passed: true });
  // Môi trường kiểm thử dùng access TTL 8 giây, chờ thực sự hết hạn để kiểm HTTP 401 rồi refresh và retry thật
  await new Promise(resolve => setTimeout(resolve, 9000));
  const countBefore = refreshCount;
  const refreshedMe = page.waitForResponse(r => r.url().endsWith("/api/v1/auth/me") && r.status() === 200);
  await page.reload(); await refreshedMe;
  await page.waitForFunction(() => !document.body.innerText.includes("Đang tải"));
  assert.equal(refreshCount - countBefore, 1);
  assert.ok(page.url().endsWith("/admin/units"));
  results.push({ check: "Access hết hạn được refresh đúng một lần và retry thành công", passed: true });
  assert.equal(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(items => items.length)), 0);
  results.push({ check: "Không có MSW hoặc service worker giả backend", passed: true });
  const output = { stage: "VC02", frontend: base, backend: api, accessTtlSeconds: 8, results };
  if (process.env.VC02_BROWSER_RESULT) await writeFile(process.env.VC02_BROWSER_RESULT, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close();
}
