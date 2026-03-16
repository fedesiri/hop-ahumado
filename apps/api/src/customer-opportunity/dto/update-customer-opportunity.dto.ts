import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCustomerOpportunityDto {
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
