import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';
import { ComentariosService } from './comentarios.service';
import { IncidentesNotificationService } from './incidentes-notification.service';
import { IncidentesSyncService } from './incidentes-sync.service';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Sistema } from '../database/entities/sistema.entity';
import { Comentario } from '../database/entities/comentario.entity';
import { EventsModule } from '../events/events.module';
import { PlaybooksService } from './playbooks.service';
import { P06ApiKeyGuard } from '../auth/guards/p06-api-key.guard';
import { IncidentesScheduler } from './incidentes.scheduler';
import { EventoAlerta } from '../database/entities/evento-alerta.entity';
import { P6NotificacionesModule } from '../p6-notificaciones/p6-notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incidente,
      HistorialEstado,
      Auditoria,
      PoliticaSla,
      Sistema,
      Comentario,
      EventoAlerta,
    ]),
    EventsModule,
    HttpModule,
    ConfigModule,
    P6NotificacionesModule,
  ],
  controllers: [IncidentesController],
  providers: [
    IncidentesService,
    ComentariosService,
    IncidentesNotificationService,
    IncidentesSyncService,
    PlaybooksService,
    P06ApiKeyGuard,
    IncidentesScheduler,
  ],
  exports: [IncidentesService, IncidentesSyncService],
})
export class IncidentesModule {}