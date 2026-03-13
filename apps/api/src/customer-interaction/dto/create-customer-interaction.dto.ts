import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateCustomerInteractionDto {
  @IsUUID("4", { message: "profileId debe ser un UUID válido" })
  profileId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
