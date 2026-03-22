import { IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetCustomerInteractionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID("4", { message: "profileId debe ser un UUID válido" })
  profileId?: string;
}
