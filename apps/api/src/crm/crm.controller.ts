import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { PaginationQueryDto, toLimit, toPage } from "../common/pagination";
import { CustomerInteractionService } from "../customer-interaction/customer-interaction.service";
import { CreateCustomerInteractionDto } from "../customer-interaction/dto/create-customer-interaction.dto";
import { CustomerOpportunityService } from "../customer-opportunity/customer-opportunity.service";
import { UpdateCustomerOpportunityDto } from "../customer-opportunity/dto/update-customer-opportunity.dto";
import { CustomerProfileService } from "../customer-profile/customer-profile.service";
import { UpdateCustomerProfileDto } from "../customer-profile/dto/update-customer-profile.dto";
import { CrmService } from "./crm.service";
import { CreateCrmCustomerDto } from "./dto/create-crm-customer.dto";
import { GetCrmCustomersQueryDto } from "./dto/get-crm-customers-query.dto";

@Controller("crm")
export class CrmController {
  constructor(
    private readonly crmService: CrmService,
    private readonly customerProfileService: CustomerProfileService,
    private readonly customerInteractionService: CustomerInteractionService,
    private readonly customerOpportunityService: CustomerOpportunityService,
  ) {}

  @Get("dashboard")
  getDashboard() {
    return this.crmService.getDashboard();
  }

  @Get("customers")
  listCustomers(@Query() query: GetCrmCustomersQueryDto) {
    return this.crmService.listCrmCustomers(
      toPage(query),
      toLimit(query),
      query.search,
      query.status,
      query.source,
      query.customerType,
      query.responsibleId,
      query.responsibleSearch,
    );
  }

  @Get("customers/:profileId")
  getCustomerDetail(@Param("profileId") profileId: string) {
    return this.crmService.getCrmCustomerDetail(profileId);
  }

  @Post("customers")
  createCustomer(@Body() dto: CreateCrmCustomerDto) {
    return this.crmService.createCrmCustomer(dto);
  }

  @Patch("customers/:profileId")
  updateCustomerProfile(@Param("profileId") profileId: string, @Body() dto: UpdateCustomerProfileDto) {
    return this.customerProfileService.update(profileId, dto);
  }

  @Get("customers/:profileId/interactions")
  listInteractions(@Param("profileId") profileId: string, @Query() query: PaginationQueryDto) {
    return this.customerInteractionService.findAll(toPage(query), toLimit(query), profileId);
  }

  @Post("customers/:profileId/interactions")
  createInteraction(
    @Param("profileId") profileId: string,
    @Body() dto: Omit<CreateCustomerInteractionDto, "profileId">,
  ) {
    return this.customerInteractionService.create({ ...dto, profileId });
  }

  @Get("customers/:profileId/opportunity")
  getOpportunity(@Param("profileId") profileId: string) {
    return this.customerOpportunityService.findByProfileId(profileId);
  }

  @Put("customers/:profileId/opportunity")
  upsertOpportunity(@Param("profileId") profileId: string, @Body() dto: UpdateCustomerOpportunityDto) {
    return this.customerOpportunityService.upsertByProfileId(profileId, dto);
  }
}
