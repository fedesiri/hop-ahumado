import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class PriceListSlotDto {
  @IsString()
  @MaxLength(64)
  id: string;

  @IsUUID("4")
  productId: string;

  @IsNumber() @Min(0) @Max(1) x: number;
  @IsNumber() @Min(0) @Max(1) y: number;
  @IsNumber() @Min(0.001) @Max(1) w: number;
  @IsNumber() @Min(0.001) @Max(1) h: number;

  @Matches(HEX_COLOR, { message: "coverColor debe ser un color #RRGGBB" })
  coverColor: string;

  @IsOptional()
  @IsIn(["flat", "blend"])
  coverMode?: "flat" | "blend";

  @Matches(HEX_COLOR, { message: "textColor debe ser un color #RRGGBB" })
  textColor: string;

  @IsIn(["left", "center", "right"])
  align: "left" | "center" | "right";

  /** Multiplicador del tamaño de letra (1 = ajustado al alto de la zona). */
  @IsNumber() @Min(0.3) @Max(2)
  fontScale: number;
}

export class UpdatePriceListTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => PriceListSlotDto)
  slots?: PriceListSlotDto[];
}
