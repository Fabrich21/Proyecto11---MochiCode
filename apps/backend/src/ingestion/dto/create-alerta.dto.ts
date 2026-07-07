import { IsNotEmpty, IsObject, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAlertaDto {
  @ApiProperty({
    description: 'Identificador del sistema origen',
    example: 'P08',
  })
  @IsString()
  @IsNotEmpty()
  sistema_id!: string;

  // Validación estricta para asegurar el estándar ISO 8601 exigido por el contrato
  @ApiProperty({
    description: 'Fecha/hora de creación de la alerta en formato ISO 8601',
    format: 'date-time',
    example: '2026-07-07T14:30:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  creado_en!: string;

  @ApiProperty({
    description: 'Payload original de la alerta emitida por el sistema fuente',
    type: 'object',
    additionalProperties: true,
    example: {
      sensor: 'temp-01',
      valor: 98.6,
      unidad: 'C',
      severidad: 'alta',
    },
  })
  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, any>;
}