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
} from "class-validator";
import { CASH_FLOW_PAYMENT_METHODS, CASH_FLOW_REIMBURSEMENT_STATUSES } from "../cash-flow.catalog";

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

  @IsOptional()
  @IsIn(CASH_FLOW_PAYMENT_METHODS)
  paymentMethod?: string;

  @IsOptional()
  @IsEnum(CashMovementStatus)
  status?: CashMovementStatus;

  @IsOptional()
  @IsString()
  payer?: string;

  @IsOptional()
  @IsIn(CASH_FLOW_REIMBURSEMENT_STATUSES)
  reimbursementStatus?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;
}
