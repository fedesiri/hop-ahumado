import { IsIn, IsNumberString, IsOptional, IsString, IsUUID } from "class-validator";
import { OrderPaymentStatus } from "../order-payment-status.enum";
import { PaginationQueryDto } from "../../common/pagination";

export class GetOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string; // ISO date

  @IsOptional()
  @IsString()
  dateTo?: string; // ISO date

  @IsOptional()
  @IsNumberString()
  minTotal?: string;

  @IsOptional()
  @IsNumberString()
  maxTotal?: string;

  @IsOptional()
  @IsIn(Object.values(OrderPaymentStatus), {
    message: `paymentStatus debe ser uno de: ${Object.values(OrderPaymentStatus).join(", ")}`,
  })
  paymentStatus?: OrderPaymentStatus;

  @IsOptional()
  @IsIn(["true", "false"], { message: "delivered debe ser true o false" })
  delivered?: "true" | "false";
}
