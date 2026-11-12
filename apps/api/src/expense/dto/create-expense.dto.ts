import { IsNumber, IsOptional, IsString, IsUUID, Matches, Min } from "class-validator";

export class CreateExpenseDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cashAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cardAmount?: number;

  /** Fecha del egreso (YYYY-MM-DD). Si no se envía, es ahora. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date debe tener formato YYYY-MM-DD" })
  date?: string;
}
