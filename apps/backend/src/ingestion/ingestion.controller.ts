import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('alertas')
  @HttpCode(HttpStatus.ACCEPTED) // Fuerza el código 202
  async recibirAlerta(@Body() createAlertaDto: CreateAlertaDto) {
    // Llama al servicio para encolar la alerta
    return this.ingestionService.encolarAlerta(createAlertaDto);
  }
}