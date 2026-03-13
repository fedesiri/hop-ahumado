import { StockMovementType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateStockMovementDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId: string;

  @IsInt()
  quantity: number; // Para IN/OUT debe ser >= 1; para ADJUSTMENT puede ser positivo o negativo (delta)

  @IsEnum(StockMovementType, { message: "type debe ser IN, OUT o ADJUSTMENT" })
  type: StockMovementType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
