import { StockMovementType } from "@prisma/client";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetStockMovementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId?: string;

  @IsOptional()
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId?: string;

  @IsOptional()
  @IsEnum(StockMovementType, { message: "type debe ser IN, OUT, ADJUSTMENT o TRANSFER" })
  type?: StockMovementType;
}
