import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { toOptionalBool } from "../../notifications/dto/get-notifications.query.dto";

export class GetCrmCustomersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  customerType?: string;

  @IsOptional()
  @IsUUID()
  /** Filtro exacto por socio responsable (preferido frente a texto libre). */
  responsibleId?: string;

  @IsOptional()
  @IsString()
  /** Texto libre: coincide con el nombre del usuario responsable (contiene, sin distinguir mayúsculas). */
  responsibleSearch?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBool(value))
  @IsBoolean()
  /** Solo clientes mayoristas con 30+ días sin comprar (misma regla que el aviso de la campanita). */
  lapsedWholesale?: boolean;
}
