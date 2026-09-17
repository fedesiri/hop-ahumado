import { IsNumber, IsUUID, Matches, Min } from "class-validator";

export class UpsertProductionPlanLineDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month debe tener formato YYYY-MM" })
  month: string;

  @IsNumber()
  @Min(0, { message: "batchesPerMonth debe ser mayor o igual a 0" })
  batchesPerMonth: number;
}
