import { IsInt, IsNumber, IsUUID, Min } from "class-validator";

export class CreateOrderItemDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId: string;

  @IsInt()
  @Min(1, { message: "La cantidad debe ser al menos 1" })
  quantity: number;

  @IsNumber()
  @Min(0, { message: "El precio debe ser mayor o igual a 0" })
  price: number;
}
