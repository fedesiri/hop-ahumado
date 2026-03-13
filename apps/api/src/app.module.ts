import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CategoryModule } from "./category/category.module";
import { CostModule } from "./cost/cost.module";
import { CustomerModule } from "./customer/customer.module";
import { PriceModule } from "./price/price.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductModule } from "./product/product.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [PrismaModule, CategoryModule, ProductModule, UserModule, CustomerModule, PriceModule, CostModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
