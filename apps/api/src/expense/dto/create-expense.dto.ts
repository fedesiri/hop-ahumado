import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cashAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cardAmount?: number;
}
