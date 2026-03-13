import { Module } from "@nestjs/common";
import { RecipeItemController } from "./recipe-item.controller";
import { RecipeItemService } from "./recipe-item.service";

@Module({
  controllers: [RecipeItemController],
  providers: [RecipeItemService],
  exports: [RecipeItemService],
})
export class RecipeItemModule {}
