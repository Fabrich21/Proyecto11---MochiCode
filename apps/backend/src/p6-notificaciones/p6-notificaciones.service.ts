import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  EnviarEmailAsignacionParams,
  EnviarNotificacionSlaParams,
  P6NotificationPayload,
} from './interfaces/p6-notification.types';

/**
 * Conectores de integración con Proyecto 6 (Notificaciones).
 *
 * - Conector Email P6: correo al asignar un ticket.
 * - Conector Móvil P6: SMS (canal móvil) al fallar un SLA.
 */
@Injectable()
export class P6NotificacionesService {
  private readonly logger = new Logger(P6NotificacionesService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>(
      'P6_NOTIFICACIONES_URL',
      'https://ucn-agil-notificaciones.up.railway.app/notifications/send',
    )!;

    this.apiKey = this.configService.get<string>(
      'API_KEY_PROYECTO_11',
      '6KqBvZyXpJ5mWkR8tHsUdC2eAoF3LiG7',
    )!;
  }

  /** Conector Email P6 — notifica al operador cuando se le asigna un ticket. */
  async enviarEmailAsignacionTicket(params: EnviarEmailAsignacionParams): Promise<void> {
    const subject = `Ticket asignado: ${params.titulo}`;
    const htmlBody = [
      '<p>Se te ha asignado un nuevo ticket en la plataforma de incidentes.</p>',
      `<p><strong>Incidente:</strong> ${params.titulo}</p>`,
      `<p><strong>ID:</strong> ${params.incidenteId}</p>`,
      `<p><strong>Usuario asignado (P12):</strong> ${params.asignadoAUsuarioId}</p>`,
    ].join('');

    await this.send({
      channel: 'email',
      recipient: { email: params.email },
      subject,
      body: { email: htmlBody },
    });

    this.logger.log(
      `Email de asignación enviado a P6 para incidente ${params.incidenteId} → ${params.email}`,
    );
  }

  /** Conector Móvil P6 — SMS urgente cuando un SLA vence. */
  async enviarNotificacionMovilSlaVencido(params: EnviarNotificacionSlaParams): Promise<void> {
    const mensaje =
      `SLA VENCIDO: "${params.titulo}" (ID: ${params.incidenteId}) ` +
      `requiere atención inmediata. Usuario: ${params.usuarioDestinoId}`;

    await this.send({
      channel: 'sms',
      recipient: { telefono: params.telefono },
      body: { sms: mensaje },
    });

    this.logger.log(
      `SMS SLA vencido enviado a P6 para incidente ${params.incidenteId} → ${params.telefono}`,
    );
  }

  private async send(payload: P6NotificationPayload): Promise<void> {
    await firstValueFrom(
      this.httpService.post(this.apiUrl, payload, {
        headers: {
          API_KEY_PROYECTO_11: this.apiKey,
          'Content-Type': 'application/json',
        },
      }),
    );
  }
}
