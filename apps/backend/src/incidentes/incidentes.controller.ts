import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { IncidentesService } from './incidentes.service';
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';

@Controller('incidentes')
export class IncidentesController {
  constructor(private readonly incidentesService: IncidentesService) {}

  @Get()
  findAll(@Query() query: GetIncidentesDto) {
    return this.incidentesService.findAll(query);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() updateEstadoIncidenteDto: UpdateEstadoIncidenteDto,
  ) {
    return this.incidentesService.cambiarEstado(id, updateEstadoIncidenteDto);
  }
}