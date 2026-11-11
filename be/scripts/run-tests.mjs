import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { error } from "node:console";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Duyệt thư mục gốc và thư mục con để trả các tệp đúng hậu tố, lỗi filesystem được lớp gọi chuyển sang câu an toàn */
function findTestFiles(directory, suffix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return findTestFiles(entryPath, suffix);
    return entry.isFile() && entry.name.endsWith(suffix) ? [entryPath] : [];
  });
}

/** Chạy các tệp đã tìm qua tsx theo thứ tự, truyền nguyên tùy chọn coverage và giữ mã thoát thực của tiến trình kiểm thử */
function runTests() {
  const [root, suffix, ...options] = process.argv.slice(2);
  if (!root || !suffix) {
    error("Cần cung cấp thư mục kiểm thử và hậu tố tên tệp");
    process.exitCode = 2;
    return;
  }

  const files = findTestFiles(resolve(root), suffix);
  if (files.length === 0) {
    error(`Không tìm thấy tệp kiểm thử ${suffix} trong ${root}`);
    process.exitCode = 1;
    return;
  }

  const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
  const runnerOptions = ["--test", "--test-concurrency=1"];
  if (options.includes("--coverage")) {
    runnerOptions.push("--experimental-test-coverage");
  }
  const result = spawnSync(process.execPath, [tsxCli, ...runnerOptions, ...files], {
    stdio: "inherit",
  });
  if (result.error) error("Không thể khởi chạy tiến trình kiểm thử. Vui lòng kiểm tra Node và dependency.");
  process.exitCode = result.status ?? 1;
}

// Giữ thông báo chủ động bằng tiếng Việt khi thư mục hoặc runtime không khả dụng, không in lỗi hệ thống thô
try { runTests(); }
catch {
  error("Không thể chuẩn bị bộ kiểm thử. Vui lòng kiểm tra thư mục và cấu hình runtime.");
  process.exitCode = 1;
}
