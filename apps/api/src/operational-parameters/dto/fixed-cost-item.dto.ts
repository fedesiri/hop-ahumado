import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateFixedCostItemDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @IsString()
  @IsNotEmpty({ message: "El concepto es obligatorio" })
  concept: string;

  @IsNumber()
  @Min(0)
  monthlyCost: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFixedCostItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  concept?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCost?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
