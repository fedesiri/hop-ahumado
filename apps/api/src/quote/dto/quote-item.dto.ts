import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";
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

  /** Cómo se nombra en el documento al cliente (ej: "sándwiches"). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  docLabel?: string;

  /** Texto que sigue al nombre en el documento. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  docDetail?: string;

  /** Sub-lista del documento (ej: sabores a elección). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  docOptions?: string[];
}
