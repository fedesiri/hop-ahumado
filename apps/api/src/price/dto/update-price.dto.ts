import { PartialType } from "@nestjs/mapped-types";
import { IsDateString, IsOptional, ValidateIf } from "class-validator";
import { CreatePriceDto } from "./create-price.dto";

export class UpdatePriceDto extends PartialType(CreatePriceDto) {
  /** Para desactivar: enviar fecha ISO. Para reactivar: enviar `null`. */
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsDateString()
  deactivatedAt?: string | null;
}
