import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StockLocationController } from "./stock-location.controller";
import { StockLocationService } from "./stock-location.service";

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [StockLocationController],
  providers: [StockLocationService],
})
export class StockLocationModule {}
