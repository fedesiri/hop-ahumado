import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class UpsertOperationalParametersDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  workDaysPerMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hoursPerShift?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityHoursPerMonth?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
