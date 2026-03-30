import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

export class UpdateStockLocationDto {
  @IsOptional()
  @ValidateIf((o: UpdateStockLocationDto) => o.name != null)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
