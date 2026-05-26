import { Controller, Get, Query } from '@nestjs/common';
import { IncidentesService } from './incidentes.service';
import { GetIncidentesDto } from './dto/get-incidentes.dto';

@Controller('incidentes')
export class IncidentesController {
  constructor(private readonly incidentesService: IncidentesService) {}

  @Get()
  findAll(@Query() query: GetIncidentesDto) {
    return this.incidentesService.findAll(query);
  }
}