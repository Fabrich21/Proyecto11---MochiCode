import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Incidente } from '../database/entities/incidente.entity';
import { ReglaEscalamiento } from '../database/entities/regla-escalamiento.entity';
import { IncidenteEstado } from '@proyecto/shared-types';

/**
 * Lógica de detección y resolución de vencimientos SLA.
 *
 * Por cada ticket vencido:
 *  1. Marca sla_vencido = TRUE y estado = VENCIDO (transacción atómica).
 *  2. Inserta en historial_estados.
 *  3. Inserta en auditoria.
 *  4. Consulta reglas_escalamiento de la política del ticket y notifica a P6.
 */
@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);
  private readonly sistemaAutomaticoUuid: string;
  private readonly p6NotificacionesUrl: string;

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Incidente)
    private readonly incidenteRepo: Repository<Incidente>,

    @InjectRepository(ReglaEscalamiento)
    private readonly reglaRepo: Repository<ReglaEscalamiento>,

    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.sistemaAutomaticoUuid = this.configService.get<string>(
      'SISTEMA_AUTOMATICO_UUID',
      '00000000-0000-0000-0000-000000000001',
    )!;

    this.p6NotificacionesUrl = this.configService.get<string>(
      'P6_NOTIFICACIONES_URL',
      'http://p6-notificaciones/api/v1/notificaciones',
    )!;
  }

  /**
   * Detecta todos los incidentes activos que superaron su tiempo SLA
   * y ejecuta la lógica de vencimiento para cada uno.
   *
   * Query: JOIN incidentes ↔ politicas_sla para comparar
   *   creado_en + (tiempo_maximo_resolucion_minutos * INTERVAL '1 min') < NOW()
   */
  async detectarYProcesarVencimientos(): Promise<void> {
    // Usamos SQL raw para aprovechar el índice parcial y hacer el JOIN en una sola pasada
    const vencidos: Array<{ id: string; politica_sla_id: string; sistema_id: string; titulo: string }> =
      await this.dataSource.query(`
        SELECT i.id, i.politica_sla_id, i.sistema_id, i.titulo
        FROM   "incidentes" i
        JOIN   "politicas_sla" p ON p.id = i.politica_sla_id
        WHERE  i.estado IN ('ABIERTO', 'EN_PROGRESO')
          AND  i.sla_vencido = FALSE
          AND  (i.creado_en + (p.tiempo_maximo_resolucion_minutos * INTERVAL '1 minute')) < NOW()
      `);

    if (vencidos.length === 0) {
      this.logger.debug('Cron SLA: sin vencimientos en este ciclo.');
      return;
    }

    this.logger.warn(`Cron SLA: ${vencidos.length} ticket(s) vencido(s) detectado(s).`);

    // Procesamos en paralelo — cada ticket tiene su propia transacción
    await Promise.allSettled(
      vencidos.map((ticket) => this.procesarVencimiento(ticket)),
    );
  }

  // ---------------------------------------------------------------------------
  // Privado: procesa UN ticket vencido dentro de una transacción atómica
  // ---------------------------------------------------------------------------
  private async procesarVencimiento(ticket: {
    id: string;
    politica_sla_id: string;
    sistema_id: string;
    titulo: string;
  }): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Actualizar estado + flag en una sola query (evita race conditions)
      await queryRunner.query(
        `UPDATE "incidentes"
         SET    "estado" = $1, "sla_vencido" = TRUE
         WHERE  "id" = $2 AND "sla_vencido" = FALSE`,
        [IncidenteEstado.VENCIDO, ticket.id],
      );

      // 2. Registrar en historial_estados (hypertable)
      await queryRunner.query(
        `INSERT INTO "historial_estados"
           ("id", "incidente_id", "estado_anterior", "estado_nuevo",
            "cambiado_por_usuario_id", "cambiado_en")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
        [
          ticket.id,
          IncidenteEstado.ABIERTO,   // estado_anterior representativo (puede ser EN_PROGRESO)
          IncidenteEstado.VENCIDO,
          this.sistemaAutomaticoUuid,
        ],
      );

      // 3. Registrar en auditoría
      await queryRunner.query(
        `INSERT INTO "auditoria"
           ("id", "incidente_id", "accion_por_usuario_id", "descripcion_accion", "creado_en")
         VALUES (gen_random_uuid(), $1, $2, $3, now())`,
        [
          ticket.id,
          this.sistemaAutomaticoUuid,
          `SLA vencido — incidente "${ticket.titulo}" superó el tiempo máximo de resolución.`,
        ],
      );

      await queryRunner.commitTransaction();
      this.logger.warn(`Ticket ${ticket.id} marcado como VENCIDO.`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al procesar vencimiento del ticket ${ticket.id}`, error);
      return; // No lanzamos: un error en un ticket no debe detener el resto
    } finally {
      await queryRunner.release();
    }

    // 4. Notificar FUERA de la transacción (el HTTP no debe bloquear el commit)
    await this.notificarEscalamientos(ticket.id, ticket.politica_sla_id, ticket.titulo);
  }

  // ---------------------------------------------------------------------------
  // Privado: consulta reglas_escalamiento y llama a P6
  // ---------------------------------------------------------------------------
  private async notificarEscalamientos(
    incidenteId: string,
    politicaSlaId: string,
    titulo: string,
  ): Promise<void> {
    const reglas = await this.reglaRepo.find({
      where: { politicaSlaId },
      order: { tiempoActivacionMinutos: 'ASC' },
    });

    if (reglas.length === 0) {
      this.logger.debug(`Sin reglas de escalamiento para la política ${politicaSlaId}.`);
      return;
    }

    for (const regla of reglas) {
      try {
        await firstValueFrom(
          this.httpService.post(this.p6NotificacionesUrl, {
            tipo: 'SLA_VENCIDO',
            incidente_id: incidenteId,
            titulo,
            notificar_a_usuario_id: regla.notificarAUsuarioId,
          }),
        );
        this.logger.log(
          `Notificación SLA_VENCIDO enviada a P6 para usuario ${regla.notificarAUsuarioId}.`,
        );
      } catch (error) {
        // HttpClientModule ya reintentó 3 veces con backoff exponencial.
        // Si aun así falla, solo lo logueamos (la auditoría ya quedó registrada).
        this.logger.error(
          `No se pudo notificar a P6 para el incidente ${incidenteId} (usuario: ${regla.notificarAUsuarioId})`,
          error,
        );
      }
    }
  }
}
