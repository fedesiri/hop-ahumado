import { Controller, Get, Query } from "@nestjs/common";
import { DistributorSuggestedOrderService } from "./distributor-suggested-order.service";
import { GetDistributorSuggestedOrderQueryDto } from "./dto/get-distributor-suggested-order.query.dto";

@Controller("distributor-suggested-order")
export class DistributorSuggestedOrderController {
  constructor(private readonly distributorSuggestedOrderService: DistributorSuggestedOrderService) {}

  @Get()
  get(@Query() query: GetDistributorSuggestedOrderQueryDto) {
    return this.distributorSuggestedOrderService.getSuggestedOrder(query);
  }
}
