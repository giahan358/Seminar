import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { error } from "node:console";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Tìm đệ quy các tệp khớp thư mục gốc và hậu tố đã cấu hình */
function findTestFiles(directory, suffix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return findTestFiles(entryPath, suffix);
    return entry.isFile() && entry.name.endsWith(suffix) ? [entryPath] : [];
  });
}

/** Chạy Node test runner qua tsx với danh sách tệp tìm được */
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
  process.exitCode = result.status ?? 1;
}

runTests();
