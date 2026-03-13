import { IsNotEmpty, IsNumber, IsUUID, Min } from "class-validator";

export class CreateCostDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  @IsNotEmpty({ message: "productId es obligatorio" })
  productId: string;

  @IsNumber()
  @Min(0, { message: "El valor debe ser mayor o igual a 0" })
  value: number;
}
