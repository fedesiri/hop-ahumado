import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsUUID, Min, ValidateNested } from "class-validator";

export class ReturnConsignmentItemDto {
  @IsUUID("4", { message: "orderItemId debe ser un UUID válido" })
  orderItemId: string;

  @IsNumber()
  @Min(0.01, { message: "La cantidad a devolver debe ser mayor a 0" })
  quantity: number;
}

export class ReturnConsignmentDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Debe enviar al menos un ítem para devolver" })
  @ValidateNested({ each: true })
  @Type(() => ReturnConsignmentItemDto)
  items: ReturnConsignmentItemDto[];
}
