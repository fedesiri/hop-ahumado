import { StockMovementType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateStockMovementDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: "quantity debe ser un número" })
  quantity: number; // IN/OUT: > 0; ADJUSTMENT: delta distinto de 0; TRANSFER: > 0

  @IsEnum(StockMovementType, { message: "type debe ser IN, OUT, ADJUSTMENT o TRANSFER" })
  type: StockMovementType;

  /** Ubicación para IN / OUT / ADJUSTMENT (si no se envía, usa la ubicación por defecto). */
  @IsOptional()
  @IsUUID("4", { message: "locationId debe ser un UUID válido" })
  locationId?: string;

  /** Origen del traslado (solo TRANSFER). */
  @IsOptional()
  @IsUUID("4", { message: "fromLocationId debe ser un UUID válido" })
  fromLocationId?: string;

  /** Destino del traslado (solo TRANSFER). */
  @IsOptional()
  @IsUUID("4", { message: "toLocationId debe ser un UUID válido" })
  toLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
