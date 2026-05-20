import { Body, Controller, Get, Patch, Query } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { UpdateTreasuryBaselineDto } from "./dto/update-treasury-baseline.dto";
import { TreasuryService } from "./treasury.service";

class GetBaselineQueryDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId!: string;
}

@Controller("treasury")
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get("baseline")
  getBaseline(@Query() query: GetBaselineQueryDto) {
    return this.treasuryService.getBaseline(query.businessLineId);
  }

  @Patch("baseline")
  updateBaseline(@Body() dto: UpdateTreasuryBaselineDto) {
    return this.treasuryService.updateBaseline(dto);
  }
}
