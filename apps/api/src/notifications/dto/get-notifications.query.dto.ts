import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination/pagination-query.dto";

export function toOptionalBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === true || v === "true" || v === "1") return true;
  if (v === false || v === "false" || v === "0") return false;
  return undefined;
}

export class GetNotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalBool(value))
  @IsBoolean()
  unreadOnly?: boolean;
}
