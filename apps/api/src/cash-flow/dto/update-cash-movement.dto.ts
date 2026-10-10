import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateCashMovementDto } from "./create-cash-movement.dto";

export class UpdateCashMovementDto extends PartialType(
  OmitType(CreateCashMovementDto, ["businessLineId"] as const),
) {}
