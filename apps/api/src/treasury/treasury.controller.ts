import { Body, Controller, Get, Patch } from "@nestjs/common";
import { UpdateTreasuryBaselineDto } from "./dto/update-treasury-baseline.dto";
import { TreasuryService } from "./treasury.service";

@Controller("treasury")
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get("baseline")
  getBaseline() {
    return this.treasuryService.getBaseline();
  }

  @Patch("baseline")
  updateBaseline(@Body() dto: UpdateTreasuryBaselineDto) {
    return this.treasuryService.updateBaseline(dto);
  }
}
