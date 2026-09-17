import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
}
