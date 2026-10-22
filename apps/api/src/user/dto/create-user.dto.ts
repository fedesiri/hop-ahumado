import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  @MaxLength(255)
  name: string;

  @IsEmail({}, { message: "El email no es válido" })
  @IsNotEmpty({ message: "El email es obligatorio" })
  email: string;
}
