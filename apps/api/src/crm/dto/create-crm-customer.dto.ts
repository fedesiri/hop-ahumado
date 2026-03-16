import { IsDateString, IsEmail, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateCrmCustomerDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

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
  @IsUUID("4")
  responsibleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  generalNotes?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;
}
