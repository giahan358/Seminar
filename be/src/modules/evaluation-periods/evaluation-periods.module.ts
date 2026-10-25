import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { EvaluationPeriodsController } from "./evaluation-periods.controller.js";
import { EvaluationPeriodsService } from "./evaluation-periods.service.js";

@Module({
  imports: [AuthModule],
  controllers: [EvaluationPeriodsController],
  providers: [EvaluationPeriodsService],
  exports: [EvaluationPeriodsService],
})
export class EvaluationPeriodsModule {}
