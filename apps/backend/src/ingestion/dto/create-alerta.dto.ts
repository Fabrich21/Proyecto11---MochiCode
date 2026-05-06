import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateAlertaDto {
  @IsString()
  @IsNotEmpty()
  sistema_id!: string; // <-- Agregamos el "!" aquí

  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, any>; // <-- Agregamos el "!" aquí
}