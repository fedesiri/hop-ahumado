import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetCostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  activeOnly?: string;
}
