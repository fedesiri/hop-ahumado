import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { CreatePriceDto } from "./dto/create-price.dto";
import { GetPricesQueryDto } from "./dto/get-prices-query.dto";
import { UpdatePriceDto } from "./dto/update-price.dto";
import { PriceService } from "./price.service";

@Controller("prices")
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Post()
  create(@Body() dto: CreatePriceDto) {
    return this.priceService.create(dto);
  }

  @Get()
  findAll(@Query() query: GetPricesQueryDto) {
    const active = query.activeOnly === "true";
    return this.priceService.findAll(toPage(query), toLimit(query), query.productId, active);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.priceService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePriceDto) {
    return this.priceService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.priceService.remove(id);
  }
}
