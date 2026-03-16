import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CustomerOpportunityService } from "./customer-opportunity.service";
import { CreateCustomerOpportunityDto } from "./dto/create-customer-opportunity.dto";
import { UpdateCustomerOpportunityDto } from "./dto/update-customer-opportunity.dto";

@Controller("customer-opportunities")
export class CustomerOpportunityController {
  constructor(private readonly customerOpportunityService: CustomerOpportunityService) {}

  @Post()
  create(@Body() dto: CreateCustomerOpportunityDto) {
    return this.customerOpportunityService.create(dto);
  }

  @Get("profile/:profileId")
  findByProfileId(@Param("profileId") profileId: string) {
    return this.customerOpportunityService.findByProfileId(profileId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customerOpportunityService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerOpportunityDto) {
    return this.customerOpportunityService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.customerOpportunityService.remove(id);
  }
}
