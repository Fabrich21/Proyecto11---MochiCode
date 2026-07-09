import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Sistema } from '../database/entities/sistema.entity';
import { Comentario } from '../database/entities/comentario.entity';
import { EventsModule } from '../events/events.module';
import { P06ApiKeyGuard } from '../auth/guards/p06-api-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incidente,
      HistorialEstado,
      Auditoria,
      PoliticaSla,
      Sistema,
      Comentario,
    ]),
    EventsModule,
  ],
  controllers: [IncidentesController],
  providers: [IncidentesService, P06ApiKeyGuard],
})
export class IncidentesModule {}