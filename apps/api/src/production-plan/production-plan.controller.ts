import { Body, Controller, Get, Param, Patch, Put, Query } from "@nestjs/common";
import { GetProductionPlanQueryDto } from "./dto/get-production-plan-query.dto";
import { UpsertProductionPlanDto } from "./dto/upsert-production-plan.dto";
import { UpsertProductionPlanLineDto } from "./dto/upsert-production-plan-line.dto";
import { ProductionPlanService } from "./production-plan.service";

@Controller("production-plans")
export class ProductionPlanController {
  constructor(private readonly service: ProductionPlanService) {}

  @Get()
  getFull(@Query() query: GetProductionPlanQueryDto) {
    return this.service.getFull(query.businessLineId, query.month);
  }

  @Patch()
  updateNotes(@Body() dto: UpsertProductionPlanDto) {
    return this.service.updateNotes(dto);
  }

  @Get("summary")
  getSummary(@Query() query: GetProductionPlanQueryDto) {
    return this.service.computeSummary(query.businessLineId, query.month);
  }

  @Put("lines/:productId")
  upsertLine(@Param("productId") productId: string, @Body() dto: UpsertProductionPlanLineDto) {
    return this.service.upsertLine(productId, dto);
  }
}
