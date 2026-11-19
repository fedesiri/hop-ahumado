import { Module } from "@nestjs/common";
import { CostModule } from "../cost/cost.module";
import { IngredientProfileModule } from "../ingredient-profile/ingredient-profile.module";
import { PurchaseCostController } from "./purchase-cost.controller";
import { PurchaseCostService } from "./purchase-cost.service";

@Module({
  imports: [CostModule, IngredientProfileModule],
  controllers: [PurchaseCostController],
  providers: [PurchaseCostService],
  exports: [PurchaseCostService],
})
export class PurchaseCostModule {}
