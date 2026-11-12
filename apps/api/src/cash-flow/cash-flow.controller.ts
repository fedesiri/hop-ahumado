import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsUUID } from "class-validator";
import type { Response } from "express";
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

  @Post("movements/:id/receipt")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadReceipt(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    return this.cashFlowService.uploadReceipt(id, file);
  }

  @Get("movements/:id/receipt")
  async getReceipt(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Res() res: Response) {
    const { buffer, contentType } = await this.cashFlowService.getReceipt(id);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buffer);
  }

  @Delete("movements/:id/receipt")
  removeReceipt(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.cashFlowService.removeReceipt(id);
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
