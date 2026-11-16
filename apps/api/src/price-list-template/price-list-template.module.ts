import { Module } from "@nestjs/common";
import { PriceListTemplateController } from "./price-list-template.controller";
import { PriceListTemplateService } from "./price-list-template.service";

@Module({
  controllers: [PriceListTemplateController],
  providers: [PriceListTemplateService],
})
export class PriceListTemplateModule {}
