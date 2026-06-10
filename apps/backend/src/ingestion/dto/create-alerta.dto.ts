import { IsNotEmpty, IsObject, IsString, IsDateString } from 'class-validator';

export class CreateAlertaDto {
  @IsString()
  @IsNotEmpty()
  sistema_id!: string;

  // Validación estricta para asegurar el estándar ISO 8601 exigido por el contrato
  @IsDateString()
  @IsNotEmpty()
  creado_en!: string;

  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, any>;
}