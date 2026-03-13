import { IsNumber, IsOptional, Min } from "class-validator";

export class UpdateRecipeItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0.001, { message: "La cantidad debe ser mayor a 0" })
  quantity?: number;
}
