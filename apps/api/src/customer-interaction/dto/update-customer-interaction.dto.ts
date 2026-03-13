import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCustomerInteractionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
