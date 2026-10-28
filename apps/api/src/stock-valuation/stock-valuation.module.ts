import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StockValuationController } from "./stock-valuation.controller";
import { StockValuationService } from "./stock-valuation.service";

@Module({
  imports: [PrismaModule],
  controllers: [StockValuationController],
  providers: [StockValuationService],
})
export class StockValuationModule {}
