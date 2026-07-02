import { IsEmail, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { IAsignarIncidenteDto } from '@proyecto/shared-types';

export class AsignarIncidenteDto implements IAsignarIncidenteDto {
  @IsUUID()
  @IsNotEmpty()
  asignadoAUsuarioId!: string;

  @IsUUID()
  @IsNotEmpty()
  usuarioId!: string;

  /** Email del operador asignado (destinatario P6). Si se omite, usa P6_DEFAULT_EMAIL. */
  @IsEmail()
  @IsOptional()
  email?: string;
}
