import { Module } from "@nestjs/common";
import { BusinessLineController } from "./business-line.controller";
import { BusinessLineService } from "./business-line.service";

@Module({
  controllers: [BusinessLineController],
  providers: [BusinessLineService],
  exports: [BusinessLineService],
})
export class BusinessLineModule {}
