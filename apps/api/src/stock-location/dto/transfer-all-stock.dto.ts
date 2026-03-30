import { IsUUID } from "class-validator";

export class TransferAllStockDto {
  @IsUUID("4", { message: "toLocationId debe ser un UUID válido" })
  toLocationId: string;
}
