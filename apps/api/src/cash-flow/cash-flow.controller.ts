import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { toLimit, toPage } from "../common/pagination";
import { CashFlowService } from "./cash-flow.service";
import { CreateCashMovementDto } from "./dto/create-cash-movement.dto";
import { GetCashMovementsQueryDto } from "./dto/get-cash-movements-query.dto";
import { GetCashSummaryQueryDto } from "./dto/get-cash-summary-query.dto";
import { UpdateCashMovementDto } from "./dto/update-cash-movement.dto";
import { UpdateCashSnapshotDto } from "./dto/update-cash-snapshot.dto";

class BusinessLineQueryDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId!: string;
}

@Controller("cash-flow")
export class CashFlowController {
  constructor(private readonly cashFlowService: CashFlowService) {}

  @Get("config")
  getConfig() {
    return this.cashFlowService.getConfig();
  }

  @Get("summary")
  getSummary(@Query() query: GetCashSummaryQueryDto) {
    return this.cashFlowService.getSummary(query);
  }

  @Get("movements")
  findAll(@Query() query: GetCashMovementsQueryDto) {
    return this.cashFlowService.findAll(query, toPage(query), toLimit(query));
  }

  @Post("movements")
  create(@Body() dto: CreateCashMovementDto) {
    return this.cashFlowService.create(dto);
  }

  @Patch("movements/:id")
  update(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: UpdateCashMovementDto) {
    return this.cashFlowService.update(id, dto);
  }

  @Delete("movements/:id")
  remove(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.cashFlowService.remove(id);
  }

  @Get("snapshot")
  getSnapshot(@Query() query: BusinessLineQueryDto) {
    return this.cashFlowService.getSnapshot(query.businessLineId);
  }

  @Put("snapshot")
  saveSnapshot(@Body() dto: UpdateCashSnapshotDto) {
    return this.cashFlowService.saveSnapshot(dto);
  }
}
