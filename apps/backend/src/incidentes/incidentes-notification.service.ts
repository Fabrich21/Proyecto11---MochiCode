import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Incidente } from '../database/entities/incidente.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { P6NotificacionesService } from '../p6-notificaciones/p6-notificaciones.service';
import { IP9Envelope, IP9Payload, P9EventType, P9Severity, P9Status, IncidenteEstado } from '@proyecto/shared-types';

@Injectable()
export class IncidentesNotificationService {
  private readonly logger = new Logger(IncidentesNotificationService.name);
  private readonly p9AnaliticaUrl: string;

  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly p6NotificacionesService: P6NotificacionesService,
  ) {
    this.p9AnaliticaUrl = this.configService.get<string>(
      'P9_ANALITICA_URL',
      'http://p9-analitica/v1/events',
    )!;
  }

  async notificarEventoAP9(incidente: Incidente, usuarioId: string, eventType: P9EventType): Promise<void> {
    const payloadData: IP9Payload = {
      incident_id: incidente.id,
      title: (eventType === 'incident_created' || eventType === 'incident_status_changed') ? incidente.titulo : undefined,
      severity: this.mapPrioridadP9(incidente.prioridad),
      status: this.mapEstadoP9(incidente.estado),
    };

    if (eventType === 'incident_created') {
      payloadData.opened_at = incidente.creadoEn?.toISOString() ?? new Date().toISOString();
    }

    if (eventType === 'incident_resolved') {
      const fechaResolucion = incidente.fechaResolucion ?? new Date();
      payloadData.resolved_at = fechaResolucion.toISOString();
      payloadData.resolution_time_hours = this.calcularMttrHoras(incidente.creadoEn, fechaResolucion);
      payloadData.sla_met = !incidente.slaVencido;
    }

    const envelope: IP9Envelope = {
      source: 'incidents',
      event_type: eventType,
      payload: payloadData,
    };

    try {
      await firstValueFrom(this.httpService.post(this.p9AnaliticaUrl, envelope));

      await this.registrarAuditoriaEventoP9(
        incidente.id,
        usuarioId,
        `Evento enviado a P09: ${eventType}.`,
      );

      this.logger.log(`Evento ${eventType} enviado a P09 para incidente ${incidente.id}.`);
    } catch (error) {
      await this.registrarAuditoriaEventoP9(
        incidente.id,
        usuarioId,
        `Fallo al enviar evento a P09: ${eventType}.`,
      );
      this.logger.error(
        `No se pudo enviar el evento ${eventType} a P09 para incidente ${incidente.id}`,
        error,
      );
    }
  }

  async notificarResolucion(incidente: Incidente): Promise<void> {
    const emailDefault = this.configService.get<string>('P6_DEFAULT_EMAIL');
    if (emailDefault) {
      try {
        await this.p6NotificacionesService.enviarEmailResolucionTicket({
          email: emailDefault,
          incidenteId: incidente.id,
          titulo: incidente.titulo,
          fechaResolucion: incidente.fechaResolucion?.toISOString() ?? new Date().toISOString()
        });
      } catch (error) {
        this.logger.error(`No se pudo enviar email P6 al cerrar incidente ${incidente.id}`, error);
      }
    }
  }

  async notificarAsignacion(incidente: Incidente, emailDestino?: string): Promise<void> {
    const email = emailDestino ?? this.configService.get<string>('P6_DEFAULT_EMAIL');

    if (email) {
      try {
        await this.p6NotificacionesService.enviarEmailAsignacionTicket({
          email,
          incidenteId: incidente.id,
          titulo: incidente.titulo,
          asignadoAUsuarioId: incidente.asignadoAUsuarioId!,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo enviar email P6 al asignar incidente ${incidente.id}`,
          error,
        );
      }
    } else {
      this.logger.warn(
        `Asignación de ${incidente.id} sin email: configure email o P6_DEFAULT_EMAIL.`,
      );
    }
  }

  private mapPrioridadP9(prioridad: string): P9Severity {
    switch (prioridad) {
      case 'CRITICA': return 'critical';
      case 'ALTA': return 'high';
      case 'MEDIA': return 'medium';
      case 'BAJA': return 'low';
      default: return 'medium';
    }
  }

  private mapEstadoP9(estado: IncidenteEstado): P9Status {
    switch (estado) {
      case IncidenteEstado.CERRADO: return 'resolved';
      case IncidenteEstado.EN_PROGRESO: return 'investigating';
      case IncidenteEstado.ABIERTO:
      case IncidenteEstado.VENCIDO:
      default: return 'open';
    }
  }

  private calcularMttrHoras(creadoEn: Date | undefined, fechaResolucion: Date): number {
    if (!creadoEn) {
      return 0;
    }
    const diferenciaMs = fechaResolucion.getTime() - creadoEn.getTime();
    return Math.max(0, Number((diferenciaMs / 3600000).toFixed(2)));
  }

  private async registrarAuditoriaEventoP9(
    incidenteId: string,
    usuarioId: string,
    descripcionAccion: string,
  ): Promise<void> {
    try {
      await this.auditoriaRepository.save({
        incidenteId,
        accionPorUsuarioId: usuarioId,
        descripcionAccion,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar auditoría de evento P09 para incidente ${incidenteId}`,
        error,
      );
    }
  }
}
