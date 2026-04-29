import { Module } from "@nestjs/common";
import { CustomerProfileModule } from "../customer-profile/customer-profile.module";
import { InventoryModule } from "../inventory/inventory.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [InventoryModule, CustomerProfileModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
