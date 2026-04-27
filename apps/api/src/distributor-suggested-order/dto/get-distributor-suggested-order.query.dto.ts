import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class GetDistributorSuggestedOrderQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "literTargetBoxes debe ser al menos 1" })
  @Max(1000, { message: "literTargetBoxes no puede superar 1000" })
  /** Cajas objetivo de inventario (12 u/caja) para cervezas de litro. */
  literTargetBoxes?: number = 5;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "halfLiterTargetBoxes debe ser al menos 1" })
  @Max(1000, { message: "halfLiterTargetBoxes no puede superar 1000" })
  /** Cajas objetivo de inventario (12 u/caja) para cervezas de medio litro. */
  halfLiterTargetBoxes?: number = 6;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "unitsPerBox debe ser al menos 1" })
  @Max(1000, { message: "unitsPerBox no puede superar 1000" })
  /** Unidades por caja al pedir al distribuidor. */
  unitsPerBox?: number = 12;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  /** Nombre de categoría a considerar (insensible a mayúsculas). */
  categoryName?: string = "Cerveza";
}
