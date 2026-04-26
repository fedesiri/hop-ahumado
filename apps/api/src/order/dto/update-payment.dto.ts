import { PaymentMethod } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdatePaymentDto {
  @IsEnum(PaymentMethod, { message: "method debe ser CASH o CARD" })
  method: PaymentMethod;
}
