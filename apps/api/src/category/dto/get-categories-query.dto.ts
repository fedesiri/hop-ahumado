import { IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetCategoriesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId?: string;
}
