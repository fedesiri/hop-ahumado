import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PaginationQueryDto, toLimit, toPage } from "../common/pagination";
import { OrderService } from "./order.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.orderService.findAll(toPage(query), toLimit(query));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.orderService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrderDto) {
    return this.orderService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.orderService.remove(id);
  }
}
