import { IsNumber, IsOptional, IsString, Min, ValidateIf } from "class-validator";

export class UpsertIngredientProfileDto {
  @IsOptional()
  @IsNumber()
  @Min(0.0001, { message: "La cantidad comprada debe ser mayor a 0" })
  purchaseQuantity?: number;

  /** `undefined` = no tocar el precio existente. `null` = borrarlo. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0, { message: "El precio de compra debe ser mayor o igual a 0" })
  purchasePrice?: number | null;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
