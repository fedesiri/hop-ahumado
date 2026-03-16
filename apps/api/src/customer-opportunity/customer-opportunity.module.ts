import { Module } from "@nestjs/common";
import { CustomerOpportunityController } from "./customer-opportunity.controller";
import { CustomerOpportunityService } from "./customer-opportunity.service";

@Module({
  controllers: [CustomerOpportunityController],
  providers: [CustomerOpportunityService],
  exports: [CustomerOpportunityService],
})
export class CustomerOpportunityModule {}
