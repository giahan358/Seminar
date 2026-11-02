import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { ConfigService } from "@nestjs/config";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { ERROR_CODES } from "./common/constants/error-codes.js";
import helmet from "helmet";
import express from "express";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(express.json({ limit: "10mb" }));
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    exceptionFactory: (errors) => new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: errors.flatMap((error) => Object.values(error.constraints ?? {}).map(
        (message) => `${error.property}: ${message}`,
      )),
    }),
  }));
  const config = app.get(ConfigService);
  const allowedOrigins = (config.get<string>("CORS_ORIGINS") ?? config.getOrThrow<string>("WEB_ORIGINS"))
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => Boolean(origin) && origin !== "*");
  if (allowedOrigins.length === 0) {
    throw new Error("Cần cấu hình ít nhất một origin cụ thể trong CORS_ORIGINS hoặc WEB_ORIGINS");
  }
  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Seminar Evaluation API")
    .setDescription("API documentation for the Seminar evaluation application.")
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Dán accessToken nhận được từ POST /api/v1/auth/login.",
      },
      "access-token",
    )
    .addSecurityRequirements("access-token")
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  swaggerDocument.components ??= {};
  swaggerDocument.components.schemas ??= {};
  swaggerDocument.components.schemas.ApiError = {
    type: "object",
    required: ["statusCode", "code", "message"],
    properties: {
      statusCode: { type: "integer", example: 400 },
      code: { type: "string", example: "VALIDATION_ERROR" },
      message: { type: "string", example: "Yêu cầu không hợp lệ" },
      details: { nullable: true, example: [{ field: "username", messages: ["Tên đăng nhập là bắt buộc"] }] },
    },
  };
  for (const pathItem of Object.values(swaggerDocument.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === "object" && "responses" in operation) {
        const responses = operation.responses as Record<string, { description?: string }>;
        for (const status of ["400", "401", "403", "404", "409", "500", "503"]) {
          if (responses[status]) responses[status] = {
            ...responses[status],
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
          } as typeof responses[string];
        }
      }
    }
  }

  SwaggerModule.setup("api/docs", app, swaggerDocument, {
    jsonDocumentUrl: "api/docs-json",
  });

  const openApiPath = resolve(process.cwd(), "docs", "openapi.json");
  await mkdir(resolve(process.cwd(), "docs"), { recursive: true });
  await writeFile(openApiPath, JSON.stringify(swaggerDocument, null, 2), "utf8");

  app.enableShutdownHooks();
  await app.listen(config.get<number>("PORT", 3000));
}

bootstrap().catch((error: unknown) => {
  console.error("Không thể khởi động ứng dụng NestJS.", error);
  process.exitCode = 1;
});
