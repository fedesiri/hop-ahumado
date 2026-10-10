import { Type } from "class-transformer";
import { IsNumber, Min, ValidateIf } from "class-validator";

export class SetBalanceWeightDto {
  /** Kg totales en la ubicación; null borra el dato. */
  @ValidateIf((o) => o.weightKg !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg!: number | null;
}
