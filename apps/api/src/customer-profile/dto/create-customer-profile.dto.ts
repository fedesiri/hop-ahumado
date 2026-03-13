import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateCustomerProfileDto {
  @IsUUID("4", { message: "customerId debe ser un UUID válido" })
  customerId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsUUID("4", { message: "responsibleId debe ser un UUID válido" })
  responsibleId?: string;

  @IsOptional()
  @IsDateString()
  lastContactAt?: string;
}
