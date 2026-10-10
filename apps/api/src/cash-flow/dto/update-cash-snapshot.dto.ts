import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsUUID } from "class-validator";

export class UpdateCashSnapshotDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId!: string;

  @Type(() => Number)
  @IsNumber()
  cash!: number;

  @Type(() => Number)
  @IsNumber()
  wallet!: number;

  @IsOptional()
  @IsDateString()
  asOf?: string;
}
