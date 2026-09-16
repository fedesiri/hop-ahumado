import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { CreateFixedCostItemDto, UpdateFixedCostItemDto } from "./dto/fixed-cost-item.dto";
import { CreatePartnerDto, UpdatePartnerDto } from "./dto/partner.dto";
import { UpsertChannelCommissionDto } from "./dto/upsert-channel-commission.dto";
import { UpsertOperationalParametersDto } from "./dto/upsert-operational-parameters.dto";
import { OperationalParametersService } from "./operational-parameters.service";

class GetOperationalParametersQueryDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId!: string;
}

@Controller("operational-parameters")
export class OperationalParametersController {
  constructor(private readonly service: OperationalParametersService) {}

  @Get()
  getFull(@Query() query: GetOperationalParametersQueryDto) {
    return this.service.getFull(query.businessLineId);
  }

  @Patch()
  update(@Body() dto: UpsertOperationalParametersDto) {
    return this.service.updateParameters(dto);
  }

  @Post("partners")
  addPartner(@Body() dto: CreatePartnerDto) {
    return this.service.addPartner(dto);
  }

  @Patch("partners/:id")
  updatePartner(@Param("id") id: string, @Body() dto: UpdatePartnerDto) {
    return this.service.updatePartner(id, dto);
  }

  @Delete("partners/:id")
  removePartner(@Param("id") id: string) {
    return this.service.removePartner(id);
  }

  @Post("fixed-costs")
  addFixedCost(@Body() dto: CreateFixedCostItemDto) {
    return this.service.addFixedCost(dto);
  }

  @Patch("fixed-costs/:id")
  updateFixedCost(@Param("id") id: string, @Body() dto: UpdateFixedCostItemDto) {
    return this.service.updateFixedCost(id, dto);
  }

  @Delete("fixed-costs/:id")
  removeFixedCost(@Param("id") id: string) {
    return this.service.removeFixedCost(id);
  }

  @Put("channel-commissions")
  upsertChannelCommission(@Body() dto: UpsertChannelCommissionDto) {
    return this.service.upsertChannelCommission(dto);
  }
}
