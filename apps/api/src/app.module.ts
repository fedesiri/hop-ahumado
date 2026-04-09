import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { FirebaseAuthGuard } from "./auth/firebase-auth.guard";
import { CategoryModule } from "./category/category.module";
import { CostModule } from "./cost/cost.module";
import { CrmModule } from "./crm/crm.module";
import { CustomerInteractionModule } from "./customer-interaction/customer-interaction.module";
import { CustomerOpportunityModule } from "./customer-opportunity/customer-opportunity.module";
import { CustomerProfileModule } from "./customer-profile/customer-profile.module";
import { CustomerModule } from "./customer/customer.module";
import { ExpenseModule } from "./expense/expense.module";
import { InventoryModule } from "./inventory/inventory.module";
import { OrderModule } from "./order/order.module";
import { PriceModule } from "./price/price.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductModule } from "./product/product.module";
import { RecipeItemModule } from "./recipe-item/recipe-item.module";
import { StockLocationModule } from "./stock-location/stock-location.module";
import { StockMovementModule } from "./stock-movement/stock-movement.module";
import { TreasuryModule } from "./treasury/treasury.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    PrismaModule,
    InventoryModule,
    AuthModule,
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
    ExpenseModule,
    StockMovementModule,
    StockLocationModule,
    RecipeItemModule,
    TreasuryModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
})
export class AppModule {}
