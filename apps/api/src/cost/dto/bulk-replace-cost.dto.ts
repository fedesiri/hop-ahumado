import { ArrayMinSize, IsArray, IsNumber, IsUUID, Min } from "class-validator";

export class BulkReplaceCostDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Seleccioná al menos un costo" })
  @IsUUID("4", { each: true, message: "Cada id de costo debe ser un UUID válido" })
  costIds: string[];

  @IsNumber()
  @Min(0, { message: "El valor debe ser mayor o igual a 0" })
  value: number;
}
