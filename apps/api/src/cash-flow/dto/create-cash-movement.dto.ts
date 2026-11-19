import { CashMovementStatus, CashMovementType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ArrayMaxSize,
  IsArray,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CASH_FLOW_PAYMENT_METHODS, CASH_FLOW_REIMBURSEMENT_STATUSES } from "../cash-flow.catalog";

export class StockPurchaseItemDto {
  @IsUUID("4", { message: "productId debe ser un UUID válido" })
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001, { message: "La cantidad comprada debe ser mayor a 0" })
  quantity!: number;
}

export class CreateCashMovementDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  counterparty?: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @ValidateIf((_, v) => v !== undefined && v !== null && v !== "")
  @IsIn(CASH_FLOW_PAYMENT_METHODS)
  paymentMethod?: string;

  @IsOptional()
  @IsEnum(CashMovementStatus)
  status?: CashMovementStatus;

  @IsOptional()
  @IsString()
  payer?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && v !== "")
  @IsIn(CASH_FLOW_REIMBURSEMENT_STATUSES)
  reimbursementStatus?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  /** Solo en gastos: productos de stock que entraron con esta compra. Suman stock solos, con la fecha del gasto. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StockPurchaseItemDto)
  stockItems?: StockPurchaseItemDto[];
}
