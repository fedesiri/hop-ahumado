import { Controller, Get } from "@nestjs/common";
import { BusinessLineService } from "./business-line.service";

@Controller("business-lines")
export class BusinessLineController {
  constructor(private readonly businessLineService: BusinessLineService) {}

  @Get()
  findAll() {
    return this.businessLineService.findAll();
  }
}
