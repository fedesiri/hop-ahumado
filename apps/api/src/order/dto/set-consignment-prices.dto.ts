import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from "class-validator";

export class SetConsignmentPriceItemDto {
  @IsUUID("4", { message: "orderItemId debe ser un UUID válido" })
  orderItemId: string;

  @IsNumber()
  @Min(0, { message: "El precio debe ser mayor o igual a 0" })
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantitySold?: number;

  @IsOptional()
  @IsIn(["RETURN_TO_STOCK", "KEEP_ON_CONSIGNMENT"])
  unsoldDisposition?: "RETURN_TO_STOCK" | "KEEP_ON_CONSIGNMENT";
}

export class SetConsignmentPricesDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Debe enviar al menos un ítem con precio" })
  @ValidateNested({ each: true })
  @Type(() => SetConsignmentPriceItemDto)
  items: SetConsignmentPriceItemDto[];
}
