import { Module } from "@nestjs/common";
import { OperationalParametersController } from "./operational-parameters.controller";
import { OperationalParametersService } from "./operational-parameters.service";

@Module({
  controllers: [OperationalParametersController],
  providers: [OperationalParametersService],
  exports: [OperationalParametersService],
})
export class OperationalParametersModule {}
