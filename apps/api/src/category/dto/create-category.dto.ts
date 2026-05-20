import { IsNotEmpty, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateCategoryDto {
  @IsUUID("4", { message: "businessLineId debe ser un UUID válido" })
  businessLineId: string;

  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  @MaxLength(255)
  name: string;
}
