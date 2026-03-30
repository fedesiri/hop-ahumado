import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CreateOrderItemDto } from "./create-order-item.dto";
import { CreatePaymentDto } from "./create-payment.dto";

export class UpdateOrderDto {
  @IsOptional()
  @ValidateIf((o: UpdateOrderDto) => o.customerId != null)
  @IsUUID("4", { message: "customerId debe ser un UUID válido" })
  customerId?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateOrderDto) => o.userId != null)
  @IsUUID("4", { message: "userId debe ser un UUID válido" })
  userId?: string | null;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  /** Al reemplazar ítems, opcionalmente cambia la ubicación de cumplimiento del pedido. */
  @IsOptional()
  @IsUUID("4", { message: "fulfillmentLocationId debe ser un UUID válido" })
  fulfillmentLocationId?: string;

  /** Si se envían ítems, deben ir junto con pagos y total (reemplazo completo de líneas + ajuste de stock). */
  @IsOptional()
  @ValidateIf((o: UpdateOrderDto) => o.items != null)
  @IsNumber()
  @Min(0, { message: "El total debe ser mayor o igual a 0" })
  total?: number;

  @IsOptional()
  @ValidateIf((o: UpdateOrderDto) => o.items != null)
  @IsArray()
  @ArrayMinSize(1, { message: "La orden debe tener al menos un ítem" })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];

  @IsOptional()
  @ValidateIf((o: UpdateOrderDto) => o.items != null)
  @IsArray()
  @ArrayMinSize(1, { message: "La orden debe tener al menos un pago" })
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentDto)
  payments?: CreatePaymentDto[];
}
