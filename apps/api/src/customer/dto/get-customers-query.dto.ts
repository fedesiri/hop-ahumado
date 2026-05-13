import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class GetCustomersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
