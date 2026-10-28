import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class GetStockValuationQueryDto {
  @IsString()
  @IsNotEmpty()
  businessLineId!: string;

  /** Fecha (YYYY-MM-DD) a la que se valoriza el stock; sin valor o futura = hoy. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "asOf debe tener formato YYYY-MM-DD" })
  asOf?: string;
}
