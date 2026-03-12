import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "page debe ser al menos 1" })
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "limit debe ser al menos 1" })
  @Max(MAX_LIMIT, { message: `limit no puede superar ${MAX_LIMIT}` })
  limit?: number = DEFAULT_LIMIT;
}

export const PAGINATION = {
  defaultPage: DEFAULT_PAGE,
  defaultLimit: DEFAULT_LIMIT,
  maxLimit: MAX_LIMIT,
} as const;

/** Convierte query a page (número entero >= 1). */
export function toPage(query: PaginationQueryDto): number {
  const n = Number(query.page);
  return Number.isInteger(n) && n >= 1 ? n : PAGINATION.defaultPage;
}

/** Convierte query a limit (número entero entre 1 y maxLimit). */
export function toLimit(query: PaginationQueryDto): number {
  const n = Number(query.limit);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, PAGINATION.maxLimit) : PAGINATION.defaultLimit;
}
