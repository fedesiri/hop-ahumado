import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";

@Module({
  imports: [InventoryModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
