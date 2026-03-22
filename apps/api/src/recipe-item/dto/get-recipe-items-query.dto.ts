import { IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetRecipeItemsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId?: string;
}
