import { IsEnum, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { IncidenteEstado } from '@proyecto/shared-types';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEstadoIncidenteDto {
  @ApiProperty({
    description: 'Nuevo estado del incidente',
    enum: IncidenteEstado,
    example: IncidenteEstado.EN_PROGRESO,
  })
  @IsEnum(IncidenteEstado)
  @IsNotEmpty()
  estado!: IncidenteEstado;

  // UUID del usuario que realiza el cambio. 
  // TODO: Esto debería extraerse del token JWT en el request cuando la auth esté implementada.
  @ApiProperty({
    description: 'UUID del usuario que realiza el cambio de estado',
    format: 'uuid',
    example: 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d',
  })
  @IsUUID()
  @IsOptional()
  usuarioId?: string;
}
