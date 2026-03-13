import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PaginationQueryDto, toLimit, toPage } from "../common/pagination";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";
import { StockMovementService } from "./stock-movement.service";

@Controller("stock-movements")
export class StockMovementController {
  constructor(private readonly stockMovementService: StockMovementService) {}

  @Post()
  create(@Body() dto: CreateStockMovementDto) {
    return this.stockMovementService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto, @Query("productId") productId?: string) {
    return this.stockMovementService.findAll(toPage(query), toLimit(query), productId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.stockMovementService.findOne(id);
  }
}
