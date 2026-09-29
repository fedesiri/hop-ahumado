import { Module } from "@nestjs/common";
import { CostModule } from "../cost/cost.module";
import { OperationalParametersModule } from "../operational-parameters/operational-parameters.module";
import { RecipeCostProfileController } from "./recipe-cost-profile.controller";
import { RecipeCostProfileService } from "./recipe-cost-profile.service";
import { RecipeCostSyncService } from "./recipe-cost-sync.service";

@Module({
  imports: [OperationalParametersModule, CostModule],
  controllers: [RecipeCostProfileController],
  providers: [RecipeCostProfileService, RecipeCostSyncService],
  exports: [RecipeCostProfileService],
})
export class RecipeCostProfileModule {}
