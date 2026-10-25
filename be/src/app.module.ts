import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module.js";
import { EvaluationPeriodsModule } from './modules/evaluation-periods/evaluation-periods.module.js';
import { CriteriaModule } from './modules/criteria/criteria.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';

import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EvaluationPeriodsModule,
    CriteriaModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
