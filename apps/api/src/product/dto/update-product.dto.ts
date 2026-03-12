import { OmitType, PartialType } from "@nestjs/mapped-types";
import { IsDateString, IsOptional, ValidateIf } from "class-validator";
import { CreateProductDto } from "./create-product.dto";

export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ["deactivationDate"])) {
  /** Para reactivar: enviar `null`. Para desactivar: enviar fecha ISO. */
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsDateString()
  deactivationDate?: string | null;
}
