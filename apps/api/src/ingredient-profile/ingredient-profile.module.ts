import { Module } from "@nestjs/common";
import { CostModule } from "../cost/cost.module";
import { IngredientProfileController } from "./ingredient-profile.controller";
import { IngredientProfileService } from "./ingredient-profile.service";

@Module({
  imports: [CostModule],
  controllers: [IngredientProfileController],
  providers: [IngredientProfileService],
  exports: [IngredientProfileService],
})
export class IngredientProfileModule {}
