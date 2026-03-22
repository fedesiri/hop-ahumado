import { StockMovementType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateStockMovementDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: "quantity debe ser un número" })
  quantity: number; // IN/OUT: > 0; ADJUSTMENT: delta distinto de 0

  @IsEnum(StockMovementType, { message: "type debe ser IN, OUT o ADJUSTMENT" })
  type: StockMovementType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
