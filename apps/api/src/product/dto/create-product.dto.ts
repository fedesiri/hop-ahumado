import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

const PRODUCT_UNITS = ["UNIT", "KG", "G", "L", "ML"] as const;

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID("4", { message: "categoryId debe ser un UUID válido" })
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: "stock debe ser un número" })
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsIn(PRODUCT_UNITS, { message: `unit debe ser uno de: ${PRODUCT_UNITS.join(", ")}` })
  unit?: (typeof PRODUCT_UNITS)[number];

  @IsOptional()
  @IsString()
  deactivationDate?: string;
}
