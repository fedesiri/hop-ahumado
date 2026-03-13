import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PaginationQueryDto, toLimit, toPage } from "../common/pagination";
import { CustomerProfileService } from "./customer-profile.service";
import { CreateCustomerProfileDto } from "./dto/create-customer-profile.dto";
import { UpdateCustomerProfileDto } from "./dto/update-customer-profile.dto";

@Controller("customer-profiles")
export class CustomerProfileController {
  constructor(private readonly customerProfileService: CustomerProfileService) {}

  @Post()
  create(@Body() dto: CreateCustomerProfileDto) {
    return this.customerProfileService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.customerProfileService.findAll(toPage(query), toLimit(query));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customerProfileService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerProfileDto) {
    return this.customerProfileService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.customerProfileService.remove(id);
  }
}
