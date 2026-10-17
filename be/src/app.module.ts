import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module.js";

import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [PrismaModule, AuthModule],
})
export class AppModule {}