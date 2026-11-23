import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { QuoteItemDto } from "./quote-item.dto";

export class CreateQuoteDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @IsOptional()
  @IsUUID("4", { message: "customerId debe ser un UUID válido" })
  customerId?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsString()
  saleType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  peopleCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1, { message: "discountPct debe expresarse como fracción entre 0 y 1" })
  discountPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraTransport?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraPackaging?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraStaff?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraOvertime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraOther?: number;

  @IsOptional()
  @IsIn(["EVENTO"], { message: "docType debe ser: EVENTO" })
  docType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  menuName?: string;

  /** Total que se muestra al cliente en lugar del calculado. null/0 = usar el calculado. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalOverride?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1, { message: "depositPct debe expresarse como fracción entre 0 y 1" })
  depositPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  infoLines?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
}
