import { Type } from "class-transformer";
import { IsNumber, IsUUID, Min } from "class-validator";

export class CreateOrderItemDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: "La cantidad debe ser un número" })
  @Min(0.0001, { message: "La cantidad debe ser mayor que 0" })
  quantity: number;

  @IsNumber()
  @Min(0, { message: "El precio debe ser mayor o igual a 0" })
  price: number;
}
