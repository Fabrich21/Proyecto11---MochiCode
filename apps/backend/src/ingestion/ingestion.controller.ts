import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';

// <-- Ajuste de ruta: Se elimina "ingestion/" para exponer /api/v1/alertas
@Controller('alertas') 
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // Fuerza el código 202
  @UseGuards(HybridAuthGuard) // SCRUM-63: Permite x-api-key (servidores) y JWT (dashboard)
  async recibirAlerta(@Body() createAlertaDto: CreateAlertaDto) {
    // Llama al servicio para encolar la alerta
    return this.ingestionService.encolarAlerta(createAlertaDto);
  }
}