import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsUUID, Min, ValidateNested } from "class-validator";

export class PurchaseCostItemDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId!: string;

  /** Cantidad comprada, en la unidad del producto (kg, L, un). */
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001, { message: "La cantidad comprada debe ser mayor a 0" })
  quantity!: number;

  /** Importe pagado por esa cantidad. */
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: "El importe pagado debe ser mayor a 0" })
  amount!: number;
}

export class ApplyPurchaseCostsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PurchaseCostItemDto)
  items!: PurchaseCostItemDto[];
}
