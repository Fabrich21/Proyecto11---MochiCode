import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Alertas')
@Controller('alertas')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(HybridAuthGuard)
  @ApiOperation({ summary: 'Recibir y encolar una alerta operacional' })
  @ApiSecurity('x-api-key')
  @ApiBearerAuth()
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
  @ApiUnauthorizedResponse({
    description: 'Credenciales invalidas o ausentes',
  })
  async recibirAlerta(@Body() createAlertaDto: CreateAlertaDto) {
    return this.ingestionService.encolarAlerta(createAlertaDto);
  }
}