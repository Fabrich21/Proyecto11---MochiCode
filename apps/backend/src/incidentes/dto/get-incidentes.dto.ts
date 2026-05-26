import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IncidenteEstado } from '../../database/entities/incidente.entity';

export class GetIncidentesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(IncidenteEstado)
  estado?: IncidenteEstado;

  @IsOptional()
  @IsString()
  sistema_id?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  orden?: 'ASC' | 'DESC' = 'DESC';
}