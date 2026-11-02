import { Global, Module } from "@nestjs/common";
import { AccessService } from "./services/access.service.js";
import { AuditService } from "./services/audit.service.js";
import { ClockService } from "./services/clock.service.js";
import { DeadlineCalculator } from "./services/deadline-calculator.js";

@Global()
@Module({ providers: [AccessService, AuditService, ClockService, DeadlineCalculator], exports: [AccessService, AuditService, ClockService, DeadlineCalculator] })
export class CommonModule { }
