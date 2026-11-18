import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class ProductionInputDto {
  @IsUUID("4")
  productId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001, { message: "La cantidad de cada insumo debe ser mayor que 0" })
  quantity: number;
}

export class CreateProductionDto {
  /** Producto que se produce (sale del proceso y suma stock). */
  @IsUUID("4")
  productId: string;

  /** Cantidad real obtenida, en la unidad del producto. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001, { message: "La cantidad producida debe ser mayor que 0" })
  quantity: number;

  /** Insumos realmente gastados (se descuentan del stock). */
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ProductionInputDto)
  inputs: ProductionInputDto[];

  @IsOptional()
  @IsUUID("4")
  locationId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date debe tener formato YYYY-MM-DD" })
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
