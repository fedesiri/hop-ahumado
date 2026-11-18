import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { CreateProductionDto } from "./dto/create-production.dto";
import { ProductionService } from "./production.service";

class TemplatesQueryDto {
  @IsUUID("4")
  businessLineId: string;
}

@Controller("production")
export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  @Get("templates")
  templates(@Query() query: TemplatesQueryDto) {
    return this.service.templates(query.businessLineId);
  }

  @Post()
  create(@Body() dto: CreateProductionDto) {
    return this.service.create(dto);
  }
}
