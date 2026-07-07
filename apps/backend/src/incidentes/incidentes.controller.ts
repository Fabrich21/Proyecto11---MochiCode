import { Controller, Get, Patch, Param, Body, Query, Post, UseGuards, Request } from '@nestjs/common';
import { IncidentesService } from './incidentes.service';
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';
import { CreateIncidenteDto } from './dto/create-incidente.dto';
import { AsignarIncidenteDto } from './dto/asignar-incidente.dto';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Incidentes')
@Controller('incidentes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentesController {
  constructor(private readonly incidentesService: IncidentesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un incidente manualmente' })
  @ApiBody({ type: CreateIncidenteDto })
  @ApiCreatedResponse({
    description: 'Incidente creado correctamente',
    schema: {
      example: {
        id: '2f4c4b54-2164-4962-a98d-22f944098f92',
        titulo: 'Caida de servicio de pagos',
        descripcion: 'Se detectan errores 503 al confirmar transacciones.',
        sistemaId: 'P04',
        creadorUsuarioId: 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d',
        prioridad: 'ALTA',
        estado: 'ABIERTO',
        asignadoAUsuarioId: null,
        politicaSlaId: 'a95f9766-4c74-42f6-8f8e-d418c56711f1',
        creadoEn: '2026-07-07T15:00:00.000Z',
        fechaLimiteResolucion: '2026-07-07T19:00:00.000Z',
        slaVencido: false,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Sistema o politica SLA no encontrados' })
  create(@Body() createIncidenteDto: CreateIncidenteDto) {
    return this.incidentesService.create(createIncidenteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar incidentes con filtros y paginacion' })
  @ApiOkResponse({
    description: 'Listado paginado de incidentes',
    schema: {
      example: {
        data: [
          {
            id: '2f4c4b54-2164-4962-a98d-22f944098f92',
            sistemaId: 'P08',
            estado: 'ABIERTO',
            prioridad: 'ALTA',
            creadoEn: '2026-07-07T15:00:00.000Z',
            fechaResolucion: null,
          },
        ],
        meta: {
          total_registros: 1,
          pagina_actual: 1,
          total_paginas: 1,
          registros_por_pagina: 10,
        },
      },
    },
  })
  findAll(@Query() query: GetIncidentesDto) {
    return this.incidentesService.findAll(query);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambiar estado de un incidente por ID' })
  @ApiParam({ name: 'id', description: 'UUID del incidente' })
  @ApiBody({ type: UpdateEstadoIncidenteDto })
  @ApiOkResponse({
    description: 'Incidente actualizado',
    schema: {
      example: {
        id: '2f4c4b54-2164-4962-a98d-22f944098f92',
        sistemaId: 'P08',
        estado: 'CERRADO',
        prioridad: 'ALTA',
        creadoEn: '2026-07-07T15:00:00.000Z',
        fechaResolucion: '2026-07-07T16:10:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Incidente no encontrado' })
  cambiarEstado(
    @Param('id') id: string,
    @Body() updateEstadoIncidenteDto: UpdateEstadoIncidenteDto,
    @Request() req: any,
  ) {
    updateEstadoIncidenteDto.usuarioId = req.user.userId;
    return this.incidentesService.cambiarEstado(id, updateEstadoIncidenteDto);
  }

  @Patch(':id/asignar')
  asignarIncidente(
    @Param('id') id: string,
    @Body() asignarIncidenteDto: AsignarIncidenteDto,
    @Request() req: any,
  ) {
    asignarIncidenteDto.usuarioId = req.user.userId;
    return this.incidentesService.asignarIncidente(id, asignarIncidenteDto);
  }
}