import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PaginationQueryDto, toLimit, toPage } from "../common/pagination";
import { CustomerService } from "./customer.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Controller("customers")
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.customerService.findAll(toPage(query), toLimit(query));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customerService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.customerService.remove(id);
  }
}
