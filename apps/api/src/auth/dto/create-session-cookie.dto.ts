import { IsString } from "class-validator";

export class CreateSessionCookieDto {
  @IsString()
  idToken!: string;
}
