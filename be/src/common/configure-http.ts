import type { INestApplication } from "@nestjs/common";
import express from "express";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter.js";
import { ApiSerializationInterceptor } from "./interceptors/api-serialization.interceptor.js";
import { createApiValidationPipe } from "./pipes/api-validation.pipe.js";

/** Cài cùng parser/pipe/filter/serializer cho server và test, gọi trước init và dùng NestFactory với bodyParser=false */
export function configureHttp(app: INestApplication): void {
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(createApiValidationPipe());
  app.useGlobalInterceptors(new ApiSerializationInterceptor());
  // Parser do ứng dụng quản lý để JSON hỏng và body quá lớn cũng qua filter tiếng Việt của Nest
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
}
