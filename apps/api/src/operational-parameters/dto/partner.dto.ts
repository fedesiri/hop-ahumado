import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreatePartnerDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  name: string;

  @IsNumber()
  @Min(0)
  monthlySalary: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePartnerDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySalary?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
