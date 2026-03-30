import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { StockMovementController } from "./stock-movement.controller";
import { StockMovementService } from "./stock-movement.service";

@Module({
  imports: [InventoryModule],
  controllers: [StockMovementController],
  providers: [StockMovementService],
  exports: [StockMovementService],
})
export class StockMovementModule {}
