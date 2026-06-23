import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Incidente } from '../database/entities/incidente.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Incidente, HistorialEstado])],
  controllers: [IncidentesController],
  providers: [IncidentesService],
})
export class IncidentesModule {}