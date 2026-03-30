import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateStockLocationDto } from "./dto/create-stock-location.dto";
import { TransferAllStockDto } from "./dto/transfer-all-stock.dto";
import { UpdateStockLocationDto } from "./dto/update-stock-location.dto";
import { StockLocationService } from "./stock-location.service";

@Controller("stock-locations")
export class StockLocationController {
  constructor(private readonly stockLocationService: StockLocationService) {}

  @Get()
  findAll() {
    return this.stockLocationService.findAll();
  }

  @Post()
  create(@Body() dto: CreateStockLocationDto) {
    return this.stockLocationService.create(dto);
  }

  /** Debe ir antes de @Patch(':id') para no capturar "balances" como id. */
  @Get(":id/balances")
  balances(@Param("id") id: string) {
    return this.stockLocationService.balancesAtLocation(id);
  }

  @Post(":id/transfer-all")
  transferAll(@Param("id") fromLocationId: string, @Body() dto: TransferAllStockDto) {
    return this.stockLocationService.transferAllStock(fromLocationId, dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateStockLocationDto) {
    return this.stockLocationService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.stockLocationService.remove(id);
  }
}
