import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { ConfigService } from "@nestjs/config";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { ERROR_CODES } from "./common/constants/error-codes.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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
  const allowedOrigins = config.getOrThrow<string>("WEB_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
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
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup("api/docs", app, swaggerDocument, {
    jsonDocumentUrl: "api/docs-json",
  });

  app.enableShutdownHooks();
  await app.listen(config.get<number>("PORT", 3000));
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start the NestJS application.", error);
  process.exitCode = 1;
});
