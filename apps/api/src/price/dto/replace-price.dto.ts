import { IsNumber, Min } from "class-validator";

export class ReplacePriceDto {
  @IsNumber()
  @Min(0, { message: "El valor debe ser mayor o igual a 0" })
  value: number;
}
