import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
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
}