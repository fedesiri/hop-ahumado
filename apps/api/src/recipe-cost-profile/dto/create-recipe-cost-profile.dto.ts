import { RecipeType } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class CreateRecipeCostProfileDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId: string;

  @IsEnum(RecipeType, { message: "recipeType debe ser PREPARACION_BASE o PRODUCTO_FINAL" })
  recipeType: RecipeType;

  @IsString()
  @IsNotEmpty({ message: "saleUnitLabel es obligatorio" })
  saleUnitLabel: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  unitsPerPack?: number;

  @IsOptional()
  @IsString()
  packName?: string;

  @IsOptional()
  @IsUUID("4", { message: "mainIngredientId debe ser un UUID válido" })
  mainIngredientId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mainIngredientQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1, { message: "cookingLossPct debe expresarse como fracción entre 0 y 1" })
  cookingLossPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  kgPerSaleUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  yieldManual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1, { message: "wastePct debe expresarse como fracción entre 0 y 1" })
  wastePct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborHoursPerBatch?: number;

  @IsOptional()
  @IsNumber()
  marginRetailPct?: number | null;

  @IsOptional()
  @IsNumber()
  marginWholesalePct?: number | null;

  @IsOptional()
  @IsNumber()
  marginCateringPct?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
