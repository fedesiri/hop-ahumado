import { IsOptional, IsString, IsUUID, Matches } from "class-validator";

export class UpsertProductionPlanDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month debe tener formato YYYY-MM" })
  month: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
