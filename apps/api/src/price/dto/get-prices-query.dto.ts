import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

const PRICE_LIST_TYPES = ["mayorista", "minorista", "fabrica"] as const;

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
  @IsIn(PRICE_LIST_TYPES, { message: "listType debe ser mayorista, minorista o fabrica" })
  listType?: string;

  @IsOptional()
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId?: string;
}
