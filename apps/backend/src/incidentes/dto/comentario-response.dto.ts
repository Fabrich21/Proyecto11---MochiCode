import { ApiProperty } from '@nestjs/swagger';

export class ComentarioResponseDto {
  @ApiProperty({
    description: 'UUID del comentario',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'UUID del incidente',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  incidenteId!: string;

  @ApiProperty({
    description: 'UUID del usuario que creó el comentario',
    format: 'uuid',
    example: 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d',
  })
  usuarioId!: string;

  @ApiProperty({
    description: 'Contenido del comentario',
    example: 'Se ha identificado que el error está en la base de datos.',
  })
  contenido!: string;

  @ApiProperty({
    description: 'Timestamp de creación',
    format: 'date-time',
    example: '2026-07-08T10:30:00.000Z',
  })
  creadoEn!: Date;
}
