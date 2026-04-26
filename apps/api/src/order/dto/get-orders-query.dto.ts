import { IsIn, IsNumberString, IsOptional, IsString } from "class-validator";
import { OrderPaymentStatus } from "../order-payment-status.enum";
import { PaginationQueryDto } from "../../common/pagination";

export class GetOrdersQueryDto extends PaginationQueryDto {
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
  @IsIn([OrderPaymentStatus.UNPAID, OrderPaymentStatus.PARTIALLY_PAID, OrderPaymentStatus.PAID], {
    message: "paymentStatus debe ser UNPAID, PARTIALLY_PAID o PAID",
  })
  paymentStatus?: OrderPaymentStatus;

  @IsOptional()
  @IsIn(["true", "false"], { message: "delivered debe ser true o false" })
  delivered?: "true" | "false";
}
