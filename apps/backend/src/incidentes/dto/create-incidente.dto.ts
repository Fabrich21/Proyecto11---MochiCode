import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IncidenteEstado } from '@proyecto/shared-types';

export class CreateIncidenteDto {
  @ApiProperty({
    description: 'Titulo del incidente',
    maxLength: 255,
    example: 'Caida de servicio de pagos',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  titulo!: string;

  @ApiPropertyOptional({
    description: 'Descripcion funcional u operacional del incidente',
    example: 'Se detectan errores 503 al intentar confirmar transacciones.',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    description: 'Sistema origen o afectado',
    example: 'P04',
  })
  @IsString()
  @IsNotEmpty()
  sistemaId!: string;

  @ApiProperty({
    description: 'UUID del usuario creador del incidente',
    format: 'uuid',
    example: 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d',
  })
  @IsUUID()
  @IsNotEmpty()
  creadorUsuarioId!: string;

  @ApiProperty({
    description: 'Prioridad del incidente. Se utiliza para resolver la politica SLA por nombre.',
    example: 'ALTA',
  })
  @IsString()
  @IsNotEmpty()
  prioridad!: string;

  @ApiPropertyOptional({
    description: 'Estado inicial del incidente',
    enum: IncidenteEstado,
    default: IncidenteEstado.ABIERTO,
    example: IncidenteEstado.ABIERTO,
  })
  @IsOptional()
  @IsEnum(IncidenteEstado)
  estado?: IncidenteEstado = IncidenteEstado.ABIERTO;

  @ApiPropertyOptional({
    description: 'UUID del usuario asignado inicialmente',
    format: 'uuid',
    example: '65a6c7d2-9dc8-4e53-b6b0-0f55bd7d5f6d',
  })
  @IsOptional()
  @IsUUID()
  asignadoAUsuarioId?: string;
}