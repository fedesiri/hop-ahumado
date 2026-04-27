import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DistributorSuggestedOrderController } from "./distributor-suggested-order.controller";
import { DistributorSuggestedOrderService } from "./distributor-suggested-order.service";

@Module({
  imports: [PrismaModule],
  controllers: [DistributorSuggestedOrderController],
  providers: [DistributorSuggestedOrderService],
})
export class DistributorSuggestedOrderModule {}
