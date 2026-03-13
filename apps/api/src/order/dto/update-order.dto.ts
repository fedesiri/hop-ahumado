import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class UpdateOrderDto {
  @IsOptional()
  @IsUUID("4", { message: "customerId debe ser un UUID válido" })
  customerId?: string;

  @IsOptional()
  @IsUUID("4", { message: "userId debe ser un UUID válido" })
  userId?: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;
}
