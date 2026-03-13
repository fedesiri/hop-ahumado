import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { CostService } from "./cost.service";
import { CreateCostDto } from "./dto/create-cost.dto";
import { GetCostsQueryDto } from "./dto/get-costs-query.dto";
import { UpdateCostDto } from "./dto/update-cost.dto";

@Controller("costs")
export class CostController {
  constructor(private readonly costService: CostService) {}

  @Post()
  create(@Body() dto: CreateCostDto) {
    return this.costService.create(dto);
  }

  @Get()
  findAll(@Query() query: GetCostsQueryDto) {
    const active = query.activeOnly === "true";
    return this.costService.findAll(toPage(query), toLimit(query), query.productId, active);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.costService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCostDto) {
    return this.costService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.costService.remove(id);
  }
}
