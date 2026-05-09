import { ArrayMinSize, IsArray, IsNumber, IsUUID, Min } from "class-validator";

export class BulkReplacePriceDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Seleccioná al menos un precio" })
  @IsUUID("4", { each: true })
  priceIds: string[];

  @IsNumber()
  @Min(0, { message: "El valor debe ser mayor o igual a 0" })
  value: number;
}
