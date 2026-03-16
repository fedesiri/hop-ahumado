import { Module } from "@nestjs/common";
import { CustomerInteractionModule } from "../customer-interaction/customer-interaction.module";
import { CustomerOpportunityModule } from "../customer-opportunity/customer-opportunity.module";
import { CustomerProfileModule } from "../customer-profile/customer-profile.module";
import { CustomerModule } from "../customer/customer.module";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";

@Module({
  imports: [CustomerModule, CustomerProfileModule, CustomerInteractionModule, CustomerOpportunityModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
