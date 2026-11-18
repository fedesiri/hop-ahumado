import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { ProductionController } from "./production.controller";
import { ProductionService } from "./production.service";

@Module({
  imports: [InventoryModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
