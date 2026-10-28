import { Controller, Get, Query } from "@nestjs/common";
import { GetStockValuationQueryDto } from "./dto/get-stock-valuation-query.dto";
import { StockValuationService } from "./stock-valuation.service";

@Controller("stock-valuation")
export class StockValuationController {
  constructor(private readonly stockValuationService: StockValuationService) {}

  @Get()
  get(@Query() query: GetStockValuationQueryDto) {
    return this.stockValuationService.getValuation(query.businessLineId, query.asOf, query.mixMode);
  }
}
