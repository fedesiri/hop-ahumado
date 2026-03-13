import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: "El email no es válido" })
  @MaxLength(255)
  email?: string;
}
