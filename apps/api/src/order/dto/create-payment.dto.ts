import { PaymentMethod } from "@prisma/client";
import { IsEnum, IsNumber, Min } from "class-validator";

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.01, { message: "El monto debe ser mayor a 0" })
  amount: number;

  @IsEnum(PaymentMethod, { message: "method debe ser CASH o CARD" })
  method: PaymentMethod;
}
