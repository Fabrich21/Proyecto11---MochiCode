import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { IncidentesService } from './incidentes.service';
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';
import { AsignarIncidenteDto } from './dto/asignar-incidente.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('incidentes')
@UseGuards(JwtAuthGuard, RolesGuard)
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
    @Request() req: any
  ) {
    updateEstadoIncidenteDto.usuarioId = req.user.userId;
    return this.incidentesService.cambiarEstado(id, updateEstadoIncidenteDto);
  }

  @Patch(':id/asignar')
  asignarIncidente(
    @Param('id') id: string,
    @Body() asignarIncidenteDto: AsignarIncidenteDto,
    @Request() req: any
  ) {
    asignarIncidenteDto.usuarioId = req.user.userId;
    return this.incidentesService.asignarIncidente(id, asignarIncidenteDto);
  }
}