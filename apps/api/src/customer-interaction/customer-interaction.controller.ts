import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { CustomerInteractionService } from "./customer-interaction.service";
import { CreateCustomerInteractionDto } from "./dto/create-customer-interaction.dto";
import { GetCustomerInteractionsQueryDto } from "./dto/get-customer-interactions-query.dto";
import { UpdateCustomerInteractionDto } from "./dto/update-customer-interaction.dto";

@Controller("customer-interactions")
export class CustomerInteractionController {
  constructor(private readonly customerInteractionService: CustomerInteractionService) {}

  @Post()
  create(@Body() dto: CreateCustomerInteractionDto) {
    return this.customerInteractionService.create(dto);
  }

  @Get()
  findAll(@Query() query: GetCustomerInteractionsQueryDto) {
    return this.customerInteractionService.findAll(toPage(query), toLimit(query), query.profileId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customerInteractionService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerInteractionDto) {
    return this.customerInteractionService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.customerInteractionService.remove(id);
  }
}
