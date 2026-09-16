import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { PRICE_LIST_TYPES } from "../../common/price-list-type";

export class GetPricesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  activeOnly?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(PRICE_LIST_TYPES, { message: `listType debe ser una de: ${PRICE_LIST_TYPES.join(", ")}` })
  listType?: string;

  @IsOptional()
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId?: string;
}
