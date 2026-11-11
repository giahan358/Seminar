import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import * as path from "node:path";
import { AuthModule } from "./modules/auth/auth.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { UnitsModule } from "./modules/units/units.module.js";
import { EvaluationPeriodsModule } from './modules/evaluation-periods/evaluation-periods.module.js';
import { CriteriaModule } from './modules/criteria/criteria.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { PrismaModule } from "./prisma/prisma.module.js";
import { validateEnvironment } from "./config/env.validation.js";
import { HealthController } from "./health/health.controller.js";
import { HttpLoggingMiddleware } from "./common/middleware/http-logging.middleware.js";
import { CommonModule } from "./common/common.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Dùng ConfigService toàn ứng dụng
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'be/.env'),
      ],
      validate: validateEnvironment,
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    UnitsModule,
    EvaluationPeriodsModule,
    CriteriaModule,
    AuditLogsModule,
  ],
  controllers: [HealthController],
  providers: [HttpLoggingMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggingMiddleware).forRoutes("*");
  }
}
