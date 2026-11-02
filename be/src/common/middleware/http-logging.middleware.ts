import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const SENSITIVE_ROUTE = /\/(?:auth\/(?:login|reset-password)|users\/change-password)(?:\/|\?|$)/i;
const SENSITIVE_KEY = /^(?:authorization|password.*|token.*|.*secret.*)$/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(item),
  ]));
}

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(request: Request & { requestId?: string }, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const safeUrl = `${request.path}${request.query && Object.keys(request.query).length ? `?${new URLSearchParams(Object.entries(redact(request.query) as Record<string, string>).map(([key, value]) => [key, String(value)]))}` : ""}`;
    const sensitiveRoute = SENSITIVE_ROUTE.test(request.path);
    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    this.logger.log(JSON.stringify({
      event: "request",
      requestId,
      method: request.method,
      url: safeUrl,
      headers: redact(request.headers),
      ...(sensitiveRoute ? { body: "[OMITTED]" } : { body: redact(request.body) }),
    }));
    response.on("finish", () => this.logger.log(JSON.stringify({
      event: "response",
      requestId,
      method: request.method,
      url: request.path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
    })));
    next();
  }
}
