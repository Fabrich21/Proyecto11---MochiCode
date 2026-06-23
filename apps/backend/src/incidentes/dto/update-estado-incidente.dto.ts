import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { IncidenteEstado, IUpdateEstadoIncidenteDto } from '@proyecto/shared-types';

export class UpdateEstadoIncidenteDto implements IUpdateEstadoIncidenteDto {
  @IsEnum(IncidenteEstado)
  @IsNotEmpty()
  estado!: IncidenteEstado;

  // UUID del usuario que realiza el cambio. 
  // TODO: Esto debería extraerse del token JWT en el request cuando la auth esté implementada.
  @IsUUID()
  @IsNotEmpty()
  usuarioId!: string;
}
