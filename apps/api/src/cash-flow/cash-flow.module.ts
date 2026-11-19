import { Module } from "@nestjs/common";
import { CostModule } from "../cost/cost.module";
import { IngredientProfileModule } from "../ingredient-profile/ingredient-profile.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CashFlowController } from "./cash-flow.controller";
import { CashFlowService } from "./cash-flow.service";

@Module({
  imports: [InventoryModule, CostModule, IngredientProfileModule],
  controllers: [CashFlowController],
  providers: [CashFlowService],
  exports: [CashFlowService],
})
export class CashFlowModule {}
