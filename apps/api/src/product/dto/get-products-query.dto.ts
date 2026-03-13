import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["true", "false"], { message: "includeDeactivated debe ser 'true' o 'false'" })
  includeDeactivated?: string;
}
