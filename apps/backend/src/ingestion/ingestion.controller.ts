import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { ZeroTrustGuard } from 'src/common/guards/zero-trust/zero-trust.guard';

@Controller('alertas')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // Fuerza el código 202
  @UseGuards(ZeroTrustGuard) // <--- Aquí activamos la seguridad
  async recibirAlerta(@Body() createAlertaDto: CreateAlertaDto) {
    // Llama al servicio para encolar la alerta
    return this.ingestionService.encolarAlerta(createAlertaDto);
  }
}