import { Module } from "@nestjs/common";
import { OperationalParametersModule } from "../operational-parameters/operational-parameters.module";
import { RecipeCostProfileController } from "./recipe-cost-profile.controller";
import { RecipeCostProfileService } from "./recipe-cost-profile.service";

@Module({
  imports: [OperationalParametersModule],
  controllers: [RecipeCostProfileController],
  providers: [RecipeCostProfileService],
  exports: [RecipeCostProfileService],
})
export class RecipeCostProfileModule {}
