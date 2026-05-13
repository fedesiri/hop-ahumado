import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetCostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  activeOnly?: string;

  /** Filtra por nombre de producto, SKU o código de barras (coincidencia parcial, sin distinguir mayúsculas). */
  @IsOptional()
  @IsString()
  search?: string;
}
