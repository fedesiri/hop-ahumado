import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { CashFlowController } from "./cash-flow.controller";
import { CashFlowService } from "./cash-flow.service";

@Module({
  imports: [InventoryModule],
  controllers: [CashFlowController],
  providers: [CashFlowService],
  exports: [CashFlowService],
})
export class CashFlowModule {}
