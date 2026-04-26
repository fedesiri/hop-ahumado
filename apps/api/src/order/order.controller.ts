import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { GetOrdersQueryDto } from "./dto/get-orders-query.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { OrderService } from "./order.service";

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  @Get()
  findAll(@Query() query: GetOrdersQueryDto) {
    return this.orderService.findAll(
      toPage(query),
      toLimit(query),
      query.customerId,
      query.userId,
      query.dateFrom,
      query.dateTo,
      query.minTotal ? Number(query.minTotal) : undefined,
      query.maxTotal ? Number(query.maxTotal) : undefined,
      query.paymentStatus,
      query.delivered,
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.orderService.findOne(id);
  }

  @Patch(":id/payments/:paymentId")
  updatePayment(
    @Param("id") id: string,
    @Param("paymentId") paymentId: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.orderService.updatePayment(id, paymentId, dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrderDto) {
    return this.orderService.update(id, dto);
  }

  @Post(":id/payments")
  createPayment(@Param("id") id: string, @Body() dto: CreatePaymentDto) {
    return this.orderService.createPayment(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.orderService.remove(id);
  }
}
