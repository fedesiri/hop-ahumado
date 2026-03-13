import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PaginationQueryDto, toLimit, toPage } from "../common/pagination";
import { CreatePriceDto } from "./dto/create-price.dto";
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
  findAll(
    @Query() query: PaginationQueryDto,
    @Query("productId") productId?: string,
    @Query("activeOnly") activeOnly?: string,
  ) {
    const active = activeOnly === "true";
    return this.priceService.findAll(toPage(query), toLimit(query), productId, active);
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
