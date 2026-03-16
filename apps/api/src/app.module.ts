import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CategoryModule } from "./category/category.module";
import { CostModule } from "./cost/cost.module";
import { CrmModule } from "./crm/crm.module";
import { CustomerInteractionModule } from "./customer-interaction/customer-interaction.module";
import { CustomerOpportunityModule } from "./customer-opportunity/customer-opportunity.module";
import { CustomerProfileModule } from "./customer-profile/customer-profile.module";
import { CustomerModule } from "./customer/customer.module";
import { OrderModule } from "./order/order.module";
import { PriceModule } from "./price/price.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductModule } from "./product/product.module";
import { RecipeItemModule } from "./recipe-item/recipe-item.module";
import { StockMovementModule } from "./stock-movement/stock-movement.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    PrismaModule,
    CategoryModule,
    ProductModule,
    UserModule,
    CustomerModule,
    CustomerProfileModule,
    CustomerInteractionModule,
    CustomerOpportunityModule,
    CrmModule,
    OrderModule,
    PriceModule,
    CostModule,
    StockMovementModule,
    RecipeItemModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
