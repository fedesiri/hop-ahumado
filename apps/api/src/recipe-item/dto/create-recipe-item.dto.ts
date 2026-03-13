import { IsNumber, IsUUID, Min } from "class-validator";

export class CreateRecipeItemDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido (receta)" })
  productId: string;

  @IsUUID("4", { message: "ingredientId debe ser un UUID válido (ingrediente)" })
  ingredientId: string;

  @IsNumber()
  @Min(0.001, { message: "La cantidad debe ser mayor a 0" })
  quantity: number;
}
