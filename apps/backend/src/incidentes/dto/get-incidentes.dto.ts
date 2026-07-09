import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { IncidenteEstado, IGetIncidentesDto } from '@proyecto/shared-types';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetIncidentesDto implements IGetIncidentesDto {
  @ApiPropertyOptional({
    description: 'Numero de pagina',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por pagina',
    minimum: 1,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filtro por estado del incidente',
    enum: IncidenteEstado,
    example: IncidenteEstado.ABIERTO,
  })
  @IsOptional()
  @IsEnum(IncidenteEstado)
  estado?: IncidenteEstado;

  @ApiPropertyOptional({
    description: 'Filtro por sistema origen',
    example: 'P08',
  })
  @IsOptional()
  @IsString()
  sistema_id?: string;

  @ApiPropertyOptional({
    description: 'Orden de fecha de creacion',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  orden?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({
    description: 'Filtro por prioridad del incidente',
    enum: ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'],
    example: 'ALTA',
  })
  @IsOptional()
  @IsEnum(['CRITICA', 'ALTA', 'MEDIA', 'BAJA'])
  prioridad?: string;

  @ApiPropertyOptional({
    description: 'Filtro por UUID del usuario asignado',
    example: 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d',
  })
  @IsOptional()
  @IsUUID()
  asignado_a?: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del rango (ISO 8601)',
    example: '2026-07-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del rango (ISO 8601)',
    example: '2026-07-31T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601()
  fecha_hasta?: string;

  @ApiPropertyOptional({
    description: 'Busqueda de texto en titulo y descripcion',
    example: 'pago',
  })
  @IsOptional()
  @IsString()
  q?: string;
}