import { Module } from "@nestjs/common";
import { CustomerInteractionController } from "./customer-interaction.controller";
import { CustomerInteractionService } from "./customer-interaction.service";

@Module({
  controllers: [CustomerInteractionController],
  providers: [CustomerInteractionService],
  exports: [CustomerInteractionService],
})
export class CustomerInteractionModule {}
