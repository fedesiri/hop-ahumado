import { InteractionChannel } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateCustomerInteractionDto {
  @IsUUID("4", { message: "profileId debe ser un UUID válido" })
  profileId: string;

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
