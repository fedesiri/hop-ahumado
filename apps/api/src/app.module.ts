import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CategoryModule } from "./category/category.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductModule } from "./product/product.module";

@Module({
  imports: [PrismaModule, CategoryModule, ProductModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
