import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateComentarioDto {
  @ApiProperty({
    description: 'Contenido del comentario',
    maxLength: 2000,
    example: 'Se ha identificado que el error está en la base de datos de transacciones.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  contenido!: string;
}
