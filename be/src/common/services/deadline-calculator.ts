import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ClockService } from "./clock.service.js";
import { ERROR_CODES } from "../constants/error-codes.js";

export type SelfEvaluationWindow = {
  publishedAt: Date | null;
  selfEvalStart: Date | null;
  selfEvalDeadline: Date | null;
};

@Injectable()
export class DeadlineCalculator {
  /** Dùng đồng hồ inject được để kiểm mốc mở/đóng mà không phụ thuộc giờ thật khi chạy regression */
  constructor(@Inject(ClockService) private readonly clock: ClockService) {}

  selfEvaluationDeadline(configuredDeadline: Date | null): Date | null {
    return configuredDeadline ? new Date(configuredDeadline) : null;
  }

  supplementDeadline(requestedAt: Date, supplementHours: number): Date {
    if (!Number.isFinite(supplementHours) || supplementHours <= 0) {
      throw new BadRequestException({
        code: ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: "Số giờ bổ sung phải lớn hơn không",
      });
    }
    return new Date(requestedAt.getTime() + supplementHours * 60 * 60 * 1000);
  }

  isExpired(deadline: Date | null, now: Date = this.clock.now()): boolean {
    return deadline !== null && now.getTime() >= deadline.getTime();
  }

  canSelfEvaluate(
    window: SelfEvaluationWindow,
    evaluationStatus: string,
    now: Date = this.clock.now(),
  ): boolean {
    return window.publishedAt !== null
      && window.selfEvalStart !== null
      && window.selfEvalDeadline !== null
      && evaluationStatus === "DRAFT"
      && now.getTime() >= window.selfEvalStart.getTime()
      && now.getTime() < window.selfEvalDeadline.getTime();
  }
}
