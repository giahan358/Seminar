import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/** Ghi metadata theo danh sách cho phép, không thu thập body/header/query kể cả trên route cấp credential */
@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  /** Sinh requestId ở server và ghi status/thời gian sau finish; route dùng mẫu Express để không lộ token trong path */
  use(request: Request & { requestId?: string }, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const startedAt = Date.now();
    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    this.logger.log(JSON.stringify({ event: "request", requestId, message: "Tiếp nhận yêu cầu HTTP" }));
    response.on("finish", () => this.logger.log(JSON.stringify({
      event: "response", requestId, message: "Đã xử lý yêu cầu HTTP",
      method: /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(request.method) ? request.method : "OTHER",
      route: typeof request.route?.path === "string" ? request.route.path : "[không xác định]",
      statusCode: response.statusCode, durationMs: Date.now() - startedAt,
    })));
    next();
  }
}
