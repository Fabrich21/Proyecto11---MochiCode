import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { IncidentesService } from './incidentes.service';
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Incidentes')
@Controller('incidentes')
export class IncidentesController {
  constructor(private readonly incidentesService: IncidentesService) {}

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
  ) {
    return this.incidentesService.cambiarEstado(id, updateEstadoIncidenteDto);
  }
}