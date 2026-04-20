import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { CreateOrderItemDto } from "./create-order-item.dto";
import { CreatePaymentDto } from "./create-payment.dto";

export class CreateOrderDto {
  @IsOptional()
  @IsUUID("4", { message: "customerId debe ser un UUID válido" })
  customerId?: string;

  @IsOptional()
  @IsUUID("4", { message: "userId debe ser un UUID válido" })
  userId?: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  /** De dónde se descuenta el stock (si no se envía, ubicación por defecto). */
  @IsOptional()
  @IsUUID("4", { message: "fulfillmentLocationId debe ser un UUID válido" })
  fulfillmentLocationId?: string;

  @IsNumber()
  @Min(0, { message: "El total debe ser mayor o igual a 0" })
  total: number;

  /**
   * Lista de precios usada al armar el pedido. Si se envía, el servidor valida total y líneas
   * (incl. promo en combos regalo cuando el subtotal umbral supera el configurado en código).
   */
  @IsOptional()
  @IsIn(["mayorista", "minorista", "fabrica"], { message: "priceListType debe ser mayorista, minorista o fabrica" })
  priceListType?: "mayorista" | "minorista" | "fabrica";

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "El comentario no puede superar los 2000 caracteres" })
  comment?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "La orden debe tener al menos un ítem" })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsArray()
  @ArrayMinSize(1, { message: "La orden debe tener al menos un pago" })
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentDto)
  payments: CreatePaymentDto[];
}
