import { PartialType } from "@nestjs/mapped-types";
import { IsDateString, IsOptional, ValidateIf } from "class-validator";
import { CreateCostDto } from "./create-cost.dto";

export class UpdateCostDto extends PartialType(CreateCostDto) {
  /** Para desactivar: enviar fecha ISO. Para reactivar: enviar `null`. */
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsDateString()
  deactivatedAt?: string | null;
}
