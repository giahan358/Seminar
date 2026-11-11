import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Body, Controller, Get, HttpException, Logger, Module, Param, ParseEnumPipe, ParseIntPipe, ParseUUIDPipe,
  Post, UseInterceptors } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsArray, IsInt, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { NextFunction, Request, Response } from "express";
import { configureHttp } from "./configure-http.js";
import { ApiArrayValidationPipe, createApiValidationPipe } from "./pipes/api-validation.pipe.js";
import { HttpLoggingMiddleware } from "./middleware/http-logging.middleware.js";
import { Prisma } from "../generated/prisma/client.js";

/** DTO con dùng điểm nguyên không âm, giúp phát hiện đường dẫn lỗi và trường lạ ở từng chỉ số mảng */
class ScoreDto {
  @IsInt({ message: "Điểm phải là số nguyên." })
  @Min(0, { message: "Điểm không được âm." })
  score!: number;
}

/** DTO cha buộc validate từng phần tử thực, không chỉ kiểm rằng scores là mảng */
class ScoresDto {
  @IsArray({ message: "Danh sách điểm phải là mảng." })
  @ValidateNested({ each: true, message: "Mỗi điểm phải là một đối tượng hợp lệ." })
  @Type(() => ScoreDto)
  scores!: ScoreDto[];
}

/** Controller chỉ có trong kiểm thử để kích hoạt pipe/parser/multipart/filter thật, không thêm route chẩn đoán vào production */
@Controller("vc01-probe")
class ProbeController {
  /** Cho pipe UUID thực từ chối đầu vào sai và trả về UUID khi hợp lệ */
  @Get("uuid/:id")
  uuid(@Param("id", ParseUUIDPipe) id: string) { return { id }; }

  /** Kích hoạt lỗi ParseInt mặc định của Nest để chứng minh filter đã dịch ở biên HTTP */
  @Get("integer/:value")
  integer(@Param("value", ParseIntPipe) value: number) { return { value }; }

  /** Kích hoạt ParseEnum thực, giữ định danh ADMIN/UNIT và dịch lỗi khi giá trị ngoài tập */
  @Get("enum/:value")
  enumeration(@Param("value", new ParseEnumPipe({ ADMIN: "ADMIN", UNIT: "UNIT" })) value: string) { return { value }; }

  /** Trả DTO đã validate để xác minh dữ liệu lồng nhau không lọt xuống nghiệp vụ khi sai cấu trúc */
  @Post("nested")
  nested(@Body(createApiValidationPipe(ScoresDto)) body: ScoresDto) { return body; }

  /** Mảng body gốc phải validate theo lớp phần tử, gồm cả primitive và field ngoài DTO */
  @Post("array")
  array(@Body(new ApiArrayValidationPipe(ScoreDto)) body: ScoreDto[]) { return body; }

  /** Dùng Multer thật giới hạn 16 byte để test lỗi dung lượng và field upload lạ mà không ghi tệp xuống đĩa */
  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 16 } }))
  upload() { return { success: true }; }

  /** Ném status do adapter có thể sinh cùng message tiếng Anh để kiểm giữ status và loại message thô */
  @Get("status/:status")
  status(@Param("status", ParseIntPipe) status: number) { throw new HttpException("Lỗi nhà cung cấp SECRET_PROVIDER", status); }

  /** Payload provider chưa có mã nội bộ phải bị loại cả details, kể cả khi lỗi thô đã có tiếng Việt và giả dạng lỗi trường */
  @Get("provider")
  provider() { throw new HttpException({ code: "PROVIDER_RAW", message: "Lỗi nhà cung cấp SECRET_PROVIDER",
    details: [{ field: "request", messages: ["Thông tin riêng SECRET_PROVIDER"] }] }, 400); }

  /** Lỗi runtime chứa credential thử không được xuất hiện trong response hoặc log stack */
  @Get("unexpected/:token")
  unexpected() { throw new Error("Mật khẩu nội bộ SECRET_RUNTIME_PASSWORD"); }

  /** Trả kiểu Prisma thật để serializer được kiểm qua HTTP JSON thay vì chỉ gọi hàm trực tiếp */
  @Get("numbers")
  numbers() { return { score: new Prisma.Decimal("10.125"), bytes: 9007199254740992n, at: new Date("2026-11-25T07:00:00+07:00") }; }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

/** Chạy server Nest trên cổng ngẫu nhiên và gửi HTTP thật để test lỗi framework cùng log, không cần backend/provider giả */
test("Nền tảng HTTP trả lỗi tiếng Việt và không log bí mật", async (context) => {
  const logs: string[] = [];
  // Thu Logger thật của middleware/filter để tìm chuỗi bí mật, không thay middleware bằng hàm redact giả lập
  context.mock.method(Logger.prototype, "log", (message: unknown) => logs.push(String(message)));
  context.mock.method(Logger.prototype, "error", (message: unknown) => logs.push(String(message)));
  const app = await NestFactory.create(ProbeModule, { bodyParser: false, logger: false });
  const logging = new HttpLoggingMiddleware();
  app.use((request: Request, response: Response, next: NextFunction) => logging.use(request, response, next));
  configureHttp(app);
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();

  /** Kiểm đúng bốn field và loại câu framework/secret thô, trả payload cho các kiểm tra đường dẫn lỗi tiếp theo */
  async function expectError(response: globalThis.Response, status: number) {
    const body = await response.json();
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(body).sort(), ["code", "details", "message", "statusCode"]);
    assert.equal(body.statusCode, status);
    const messages: Record<number, string> = {
      400: "Dữ liệu gửi lên không hợp lệ.", 401: "Bạn cần đăng nhập để thực hiện thao tác này.",
      403: "Bạn không có quyền thực hiện thao tác này.", 404: "Không tìm thấy tài nguyên được yêu cầu.",
      405: "Phương thức yêu cầu không được hỗ trợ.", 409: "Dữ liệu bị trùng hoặc xung đột với trạng thái hiện tại.",
      413: "Dữ liệu hoặc tệp gửi lên vượt dung lượng cho phép.", 415: "Định dạng nội dung gửi lên không được hỗ trợ.",
      422: "Trạng thái hiện tại không cho phép thực hiện thao tác này.", 500: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      503: "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.",
    };
    assert.equal(body.message, messages[status]);
    assert.ok(Array.isArray(body.details));
    assert.doesNotMatch(JSON.stringify(body), /Cannot GET|Validation failed|Provider secret|SECRET_RUNTIME|Unexpected field|File too large/);
    return body;
  }
  try {
    // Cố tình gửi UUID/số/enum sai và status khác nhau để câu tiếng Việt không làm mất ý nghĩa mã HTTP
    await context.test("pipe, route và status mặc định qua HTTP", async () => {
      for (const path of ["uuid/sai-ma", "integer/abc", "enum/OTHER"]) await expectError(await fetch(`${base}/vc01-probe/${path}`), 400);
      await expectError(await fetch(`${base}/khong-ton-tai?token=SECRET_QUERY`), 404);
      for (const status of [401, 403, 405, 409, 413, 415, 422, 500, 503]) {
        await expectError(await fetch(`${base}/vc01-probe/status/${status}`), status);
      }
      await expectError(await fetch(`${base}/vc01-probe/unexpected/SECRET_PATH`), 500);
      const provider = await expectError(await fetch(`${base}/vc01-probe/provider`), 400);
      assert.deepEqual(provider.details, []);
    });
    // Kiểm parser trước DTO và đường dẫn từng phần tử sau DTO, gồm cả field lạ ở cha và trong mảng con
    await context.test("JSON hỏng, body quá lớn và validator nested/array", async () => {
      const send = (path: string, body: string) => fetch(`${base}/vc01-probe/${path}`, {
        method: "POST", headers: { "content-type": "application/json" }, body,
      });
      await expectError(await send("nested", '{"scores":'), 400);
      await expectError(await send("nested", JSON.stringify({ scores: [], extra: "SECRET_FIELD" })), 400);
      const nested = await expectError(await send("nested", JSON.stringify({ scores: [{ score: -1, extra: true }] })), 400);
      assert.ok(nested.details.some((detail: { field: string }) => detail.field === "scores.0.score"));
      assert.ok(nested.details.some((detail: { field: string }) => detail.field === "scores.0.extra"));
      assert.deepEqual(nested.details.find((detail: { field: string }) => detail.field === "scores.0.score").messages, ["Điểm không được âm."]);
      assert.deepEqual(nested.details.find((detail: { field: string }) => detail.field === "scores.0.extra").messages, ["Trường này không được phép gửi lên."]);
      const array = await expectError(await send("array", '[{"score":-1}]'), 400);
      assert.equal(array.details[0].field, "0.score");
      await expectError(await send("array", '[null]'), 400);
      await expectError(await send("array", '{}'), 400);
      await expectError(await send("nested", JSON.stringify({ scores: [], extra: "x".repeat(10 * 1024 * 1024) })), 413);
    });
    // Gửi FormData/chuỗi multipart hỏng thực qua mạng để Multer/Busboy phát sinh lỗi, không tự tạo ngoại lệ giả của provider
    await context.test("multipart thật dịch lỗi dung lượng và field upload", async () => {
      for (const [field, content, status] of [["file", "x".repeat(32), 413], ["unknown", "x", 400]] as const) {
        const body = new FormData();
        body.append(field, new Blob([content]), "kiem-thu.txt");
        await expectError(await fetch(`${base}/vc01-probe/upload`, { method: "POST", body }), status);
      }
      for (const contentType of ["multipart/form-data", "multipart/form-data; boundary=vc01-boundary"]) {
        await expectError(await fetch(`${base}/vc01-probe/upload`, { method: "POST", headers: { "content-type": contentType }, body: "du-lieu-multipart-hong" }), 400);
      }
    });
    // Đọc JSON từ response để phát hiện lỗi BigInt stringify hoặc Decimal tự đổi thành chuỗi ở adapter
    await context.test("JSON number/chuỗi lớn/ngày UTC đúng giao ước", async () => {
      assert.deepEqual(await (await fetch(`${base}/vc01-probe/numbers`)).json(), {
        score: 10.13, bytes: "9007199254740992", at: "2026-11-25T00:00:00.000Z",
      });
    });
    // Đặt secret thử ở mọi vị trí request và lỗi runtime rồi kiểm toàn bộ log thu được, không chỉ kiểm helper redact
    await context.test("log middleware không chứa query, body, header, path token hoặc stack", async () => {
      const response = await fetch(`${base}/vc01-probe/nested?refreshToken=SECRET_QUERY`, {
        method: "POST", headers: { "content-type": "application/json", authorization: "Bearer SECRET_AUTH", cookie: "session=SECRET_COOKIE", "x-api-key": "SECRET_KEY" },
        body: JSON.stringify({ scores: [], password: "SECRET_PASSWORD", currentPassword: "SECRET_CURRENT", newPassword: "SECRET_NEW", refreshToken: "SECRET_REFRESH", ciphertext: "SECRET_CIPHER", nested: [{ secret: "SECRET_NESTED" }] }),
      });
      assert.ok(response.headers.get("x-request-id"));
      await response.text();
      const serialized = logs.join("\n");
      assert.match(serialized, /requestId/);
      assert.doesNotMatch(serialized, /SECRET_|secret-secret|Bearer|session=|stack|ciphertext/);
    });
  } finally { await app.close(); }
});
