import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { PRICE_LIST_TYPES } from "../../common/price-list-type";

export class UpsertChannelCommissionDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @IsIn(PRICE_LIST_TYPES, { message: `channel debe ser una de: ${PRICE_LIST_TYPES.join(", ")}` })
  channel: string;

  @IsNumber()
  @Min(0)
  @Max(1, { message: "commissionPct debe expresarse como fracción entre 0 y 1" })
  commissionPct: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
