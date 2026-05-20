import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId?: string;

  @IsOptional()
  @IsIn(["true", "false"], { message: "includeDeactivated debe ser 'true' o 'false'" })
  includeDeactivated?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
