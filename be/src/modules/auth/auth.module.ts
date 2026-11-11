import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard, RolesGuard } from "../../common/guards/jwt-auth.guard.js";

@Global()
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      /** Pin thuật toán và nơi phát hành/nhận cho mọi consumer JWT, giá trị env đã được validate khi khởi động */
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { algorithm: "HS256", issuer: config.get<string>("JWT_ISSUER", "seminar-api"), audience: config.get<string>("JWT_AUDIENCE", "seminar-web") },
        verifyOptions: { algorithms: ["HS256"], issuer: config.get<string>("JWT_ISSUER", "seminar-api"), audience: config.get<string>("JWT_AUDIENCE", "seminar-web") },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
