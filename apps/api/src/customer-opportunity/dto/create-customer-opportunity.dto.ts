import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateCustomerOpportunityDto {
  @IsUUID("4", { message: "customerProfileId debe ser un UUID válido" })
  customerProfileId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  stage?: string;

  @IsOptional()
  @IsNumber()
  estimatedValue?: number;

  @IsOptional()
  @IsDateString()
  expectedClosingDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
