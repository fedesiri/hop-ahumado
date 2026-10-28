import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export const STOCK_VALUATION_MIX_MODES = ["product", "global"] as const;
export type StockValuationMixMode = (typeof STOCK_VALUATION_MIX_MODES)[number];

export class GetStockValuationQueryDto {
  @IsString()
  @IsNotEmpty()
  businessLineId!: string;

  /** Fecha (YYYY-MM-DD) a la que se valoriza el stock; sin valor o futura = hoy. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "asOf debe tener formato YYYY-MM-DD" })
  asOf?: string;

  /** "product": mix propio de cada producto (con fallback al global); "global": mix global para todos. */
  @IsOptional()
  @IsIn(STOCK_VALUATION_MIX_MODES, { message: `mixMode debe ser una de: ${STOCK_VALUATION_MIX_MODES.join(", ")}` })
  mixMode?: StockValuationMixMode;
}
