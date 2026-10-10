import { Module } from "@nestjs/common";
import { CashFlowModule } from "../cash-flow/cash-flow.module";
import { CustomerProfileModule } from "../customer-profile/customer-profile.module";
import { InventoryModule } from "../inventory/inventory.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [CashFlowModule, InventoryModule, CustomerProfileModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
