import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { ConfigService } from "@nestjs/config";
import { configureHttp } from "./common/configure-http.js";
import { corsOrigins } from "./config/env.validation.js";
import helmet from "helmet";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/** Khởi động ESM với parser/filter dùng chung, UTC ở server và CORS cụ thể trước khi phục vụ API nghiệp vụ */
async function bootstrap(): Promise<void> {
  process.env.TZ = "UTC";
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  // Swagger local dùng HTTP nên bỏ nâng cấp HTTPS tự động, các header bảo vệ khác vẫn do Helmet thiết lập
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "upgrade-insecure-requests": null,
    } },
  }));
  configureHttp(app);
  // Mặc định lấy IP socket, không tin X-Forwarded-For khi chưa có môi trường proxy được xác định để tránh giả mạo audit
  app.getHttpAdapter().getInstance().set("trust proxy", false);
  app.enableCors({
    origin: corsOrigins({ CORS_ORIGINS: config.get("CORS_ORIGINS"), WEB_ORIGINS: config.get("WEB_ORIGINS") }),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
  });

  // Khai báo Bearer theo controller để login/refresh public không bị Swagger gắn yêu cầu token toàn cục
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Seminar Evaluation API")
    .setDescription("Tài liệu API hệ thống đánh giá và xếp loại thi đua.")
    .setVersion("1.0")
    .addBearerAuth({
      type: "http", scheme: "bearer", bearerFormat: "JWT",
      description: "Dán accessToken nhận được từ POST /api/v1/auth/login, không cần gõ chữ Bearer.",
    }, "access-token")
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  swaggerDocument.components ??= {};
  swaggerDocument.components.schemas ??= {};
  swaggerDocument.components.schemas.ApiError = {
    type: "object", required: ["statusCode", "code", "message", "details"],
    properties: {
      statusCode: { type: "integer", example: 400 },
      code: { type: "string", example: "VALIDATION_ERROR" },
      message: { type: "string", example: "Dữ liệu gửi lên không hợp lệ." },
      details: { type: "array", items: {
        type: "object", required: ["field", "messages"], properties: {
          field: { type: "string" }, messages: { type: "array", items: { type: "string" } },
        },
      }, example: [{ field: "username", messages: ["Tên đăng nhập là bắt buộc."] }] },
    },
  };
  // Bổ sung lỗi framework cho mọi operation, kể cả khi decorator trước đây chỉ mô tả response thành công
  const descriptions: Record<string, string> = {
    "400": "Dữ liệu gửi lên không hợp lệ", "401": "Cần đăng nhập",
    "403": "Không có quyền truy cập", "404": "Không tìm thấy tài nguyên",
    "405": "Phương thức không được hỗ trợ", "409": "Dữ liệu xung đột",
    "413": "Dữ liệu vượt dung lượng", "415": "Định dạng không được hỗ trợ",
    "422": "Vi phạm quy tắc nghiệp vụ", "500": "Lỗi hệ thống", "503": "Dịch vụ tạm thời không khả dụng",
  };
  for (const pathItem of Object.values(swaggerDocument.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === "object" && "responses" in operation) {
        const responses = operation.responses as Record<string, unknown>;
        for (const [status, description] of Object.entries(descriptions)) {
          responses[status] = {
            description, content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
          };
        }
      }
    }
  }
  SwaggerModule.setup("api/docs", app, swaggerDocument, {
    jsonDocumentUrl: "api/docs-json", swaggerOptions: { persistAuthorization: true },
  });

  // Chỉ xuất khi chỉ định đích, tránh ghi đè OpenAPI có thay đổi cục bộ và không in lỗi filesystem chứa dữ liệu thô
  const outputFile = config.get<string>("OPENAPI_OUTPUT_FILE");
  if (outputFile) {
    try {
      const target = resolve(outputFile);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify(swaggerDocument, null, 2), "utf8");
    } catch {
      console.warn("Không thể ghi tệp tài liệu OpenAPI. Vui lòng kiểm tra đường dẫn và quyền ghi.");
    }
  }
  app.enableShutdownHooks();
  await app.listen(config.get<number>("PORT", 3000));
}

// Dừng với mã lỗi nếu bootstrap thất bại, chỉ in lỗi cấu hình đã kiểm soát thay vì stack/URL kết nối chứa secret */
bootstrap().catch(() => {
   console.error("Không thể khởi động ứng dụng NestJS. Vui lòng kiểm tra cấu hình và kết nối cơ sở dữ liệu.");
   process.exitCode = 1;
 });
