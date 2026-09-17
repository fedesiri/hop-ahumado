import { Module } from "@nestjs/common";
import { OperationalParametersModule } from "../operational-parameters/operational-parameters.module";
import { RecipeCostProfileModule } from "../recipe-cost-profile/recipe-cost-profile.module";
import { ProductionPlanController } from "./production-plan.controller";
import { ProductionPlanService } from "./production-plan.service";

@Module({
  imports: [OperationalParametersModule, RecipeCostProfileModule],
  controllers: [ProductionPlanController],
  providers: [ProductionPlanService],
  exports: [ProductionPlanService],
})
export class ProductionPlanModule {}
