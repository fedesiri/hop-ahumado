import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertIngredientProfileDto {
  @IsOptional()
  @IsNumber()
  @Min(0.0001, { message: "La cantidad comprada debe ser mayor a 0" })
  purchaseQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: "El precio de compra debe ser mayor o igual a 0" })
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
