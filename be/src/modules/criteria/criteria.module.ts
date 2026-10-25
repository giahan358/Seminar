import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CriteriaController } from "./criteria.controller.js";
import { CriteriaService } from "./criteria.service.js";

@Module({
  imports: [AuthModule],
  controllers: [CriteriaController],
  providers: [CriteriaService],
  exports: [CriteriaService],
})
export class CriteriaModule {}
