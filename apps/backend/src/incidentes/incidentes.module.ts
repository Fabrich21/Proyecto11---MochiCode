import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incidente, HistorialEstado]),
    EventsModule,
  ],
  controllers: [IncidentesController],
  providers: [IncidentesService],
})
export class IncidentesModule {}