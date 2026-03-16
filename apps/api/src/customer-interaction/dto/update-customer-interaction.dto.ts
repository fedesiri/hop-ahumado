import { InteractionChannel } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCustomerInteractionDto {
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextStep?: string;
}
