import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { ZeroTrustGuard } from '../common/guards/zero-trust/zero-trust.guard';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

// <-- Ajuste de ruta: Se elimina "ingestion/" para exponer /api/v1/alertas
@ApiTags('Alertas')
@Controller('alertas') 
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // Fuerza el código 202
  @UseGuards(ZeroTrustGuard) // Mantenemos seguridad por API Key para IoT temporalmente
  @ApiOperation({ summary: 'Recibir y encolar una alerta operacional' })
  @ApiSecurity('x-api-key')
  @ApiBody({ type: CreateAlertaDto })
  @ApiAcceptedResponse({
    description: 'Alerta aceptada para procesamiento asincrono',
    schema: {
      example: {
        estado: 'aceptado',
        mensaje: 'Alerta recibida y encolada para procesamiento asíncrono',
        sistema_origen: 'P08',
        timestamp: '2026-07-07T15:00:00.000Z',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'API Key invalida o ausente' })
  async recibirAlerta(@Body() createAlertaDto: CreateAlertaDto) {
    // Llama al servicio para encolar la alerta
    return this.ingestionService.encolarAlerta(createAlertaDto);
  }
}