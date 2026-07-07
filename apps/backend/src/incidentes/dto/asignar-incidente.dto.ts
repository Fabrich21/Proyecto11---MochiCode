import { IsEmail, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AsignarIncidenteDto {
  @IsUUID()
  @IsNotEmpty()
  asignadoAUsuarioId!: string;

  @IsUUID()
  @IsOptional()
  usuarioId?: string;

  /** Email del operador asignado (destinatario P6). Si se omite, usa P6_DEFAULT_EMAIL. */
  @IsEmail()
  @IsOptional()
  email?: string;
}
