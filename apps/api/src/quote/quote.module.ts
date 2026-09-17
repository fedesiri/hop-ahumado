import { Module } from "@nestjs/common";
import { RecipeCostProfileModule } from "../recipe-cost-profile/recipe-cost-profile.module";
import { QuoteController } from "./quote.controller";
import { QuoteService } from "./quote.service";

@Module({
  imports: [RecipeCostProfileModule],
  controllers: [QuoteController],
  providers: [QuoteService],
  exports: [QuoteService],
})
export class QuoteModule {}
