import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import * as path from "node:path";
import { AuthModule } from "./modules/auth/auth.module.js";
import { EvaluationPeriodsModule } from './modules/evaluation-periods/evaluation-periods.module.js';
import { CriteriaModule } from './modules/criteria/criteria.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { PrismaModule } from "./prisma/prisma.module.js";
import { envValidationSchema } from "./config/env.validation.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Dùng ConfigService toàn ứng dụng
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'be/.env'),
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true, // Bỏ qua biến môi trường ngoài schema
        abortEarly: false, // Hiển thị toàn bộ lỗi cùng lúc
      },
    }),
    PrismaModule,
    AuthModule,
    EvaluationPeriodsModule,
    CriteriaModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
