import { Body, Controller, Post } from "@nestjs/common";
import { ApplyPurchaseCostsDto } from "./dto/apply-purchase-costs.dto";
import { PurchaseCostService } from "./purchase-cost.service";

@Controller("purchase-costs")
export class PurchaseCostController {
  constructor(private readonly purchaseCost: PurchaseCostService) {}

  /** Actualiza el costo de los productos con el precio pagado en una compra. */
  @Post()
  apply(@Body() dto: ApplyPurchaseCostsDto) {
    return this.purchaseCost.applyMany(dto.items);
  }
}
