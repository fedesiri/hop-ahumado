import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsUUID, Min } from "class-validator";

export class UpdateTreasuryBaselineDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingCash!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingCard!: number;

  @IsDateString()
  deltaSince!: string;
}
