import { IsIn, IsNumber, IsOptional, IsUUID, Min } from "class-validator";
import { PRICE_LIST_TYPES, type PriceListType } from "../../common/price-list-type";

export class QuoteItemDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId: string;

  @IsIn(PRICE_LIST_TYPES, { message: `channel debe ser una de: ${PRICE_LIST_TYPES.join(", ")}` })
  channel: PriceListType;

  @IsNumber()
  @Min(0.001, { message: "La cantidad debe ser mayor a 0" })
  quantity: number;

  /** Si no se envía, el servidor completa el precio final del canal. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}
