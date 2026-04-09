import { Type } from "class-transformer";
import { IsDateString, IsNumber, Min } from "class-validator";

export class UpdateTreasuryBaselineDto {
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
