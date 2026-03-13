import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
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

  @IsNumber()
  @Min(0, { message: "El total debe ser mayor o igual a 0" })
  total: number;

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
