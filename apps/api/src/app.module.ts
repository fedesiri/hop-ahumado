import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { SlowRequestInterceptor } from "./common/slow-request.interceptor";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { FirebaseAuthGuard } from "./auth/firebase-auth.guard";
import { BusinessLineModule } from "./business-line/business-line.module";
import { CategoryModule } from "./category/category.module";
import { CostModule } from "./cost/cost.module";
import { CrmModule } from "./crm/crm.module";
import { CustomerInteractionModule } from "./customer-interaction/customer-interaction.module";
import { CustomerOpportunityModule } from "./customer-opportunity/customer-opportunity.module";
import { CustomerProfileModule } from "./customer-profile/customer-profile.module";
import { CustomerModule } from "./customer/customer.module";
import { DistributorSuggestedOrderModule } from "./distributor-suggested-order/distributor-suggested-order.module";
import { ExpenseModule } from "./expense/expense.module";
import { InventoryModule } from "./inventory/inventory.module";
import { NotificationsModule } from "./notifications/notifications.module";
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
    LoggerModule.forRoot({
      pinoHttp: {
        messageKey: "message",
        formatters: {
          level(label: string) {
            const map: Record<string, string> = {
              trace: "DEBUG",
              debug: "DEBUG",
              info: "INFO",
              warn: "WARNING",
              error: "ERROR",
              fatal: "CRITICAL",
            };
            return { severity: map[label] ?? label.toUpperCase() };
          },
        },
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        autoLogging: true,
        redact: ["req.headers.authorization"],
      },
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    InventoryModule,
    AuthModule,
    BusinessLineModule,
    CategoryModule,
    ProductModule,
    UserModule,
    CustomerModule,
    CustomerProfileModule,
    CustomerInteractionModule,
    CustomerOpportunityModule,
    CrmModule,
    DistributorSuggestedOrderModule,
    OrderModule,
    PriceModule,
    CostModule,
    ExpenseModule,
    StockMovementModule,
    StockLocationModule,
    RecipeItemModule,
    TreasuryModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SlowRequestInterceptor,
    },
  ],
})
export class AppModule {}
