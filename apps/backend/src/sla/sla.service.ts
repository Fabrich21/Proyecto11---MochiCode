import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Incidente } from '../database/entities/incidente.entity';
import { ReglaEscalamiento } from '../database/entities/regla-escalamiento.entity';
import { IncidenteEstado } from '@proyecto/shared-types';
import { P6NotificacionesService } from '../p6-notificaciones/p6-notificaciones.service';

/**
 * Lógica de detección y resolución de vencimientos SLA.
 *
 * Por cada ticket vencido:
 *  1. Marca sla_vencido = TRUE y estado = VENCIDO (transacción atómica).
 *  2. Inserta en historial_estados.
 *  3. Inserta en auditoria.
 *  4. Consulta reglas_escalamiento y notifica vía Conector Móvil P6 (SMS).
 */
@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);
  private readonly sistemaAutomaticoUuid: string;

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Incidente)
    private readonly incidenteRepo: Repository<Incidente>,

    @InjectRepository(ReglaEscalamiento)
    private readonly reglaRepo: Repository<ReglaEscalamiento>,

    private readonly p6NotificacionesService: P6NotificacionesService,
    private readonly configService: ConfigService,
  ) {
    this.sistemaAutomaticoUuid = this.configService.get<string>(
      'SISTEMA_AUTOMATICO_UUID',
      '00000000-0000-0000-0000-000000000001',
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

    await Promise.allSettled(
      vencidos.map((ticket) => this.procesarVencimiento(ticket)),
    );
  }

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
      await queryRunner.query(
        `UPDATE "incidentes"
         SET    "estado" = $1, "sla_vencido" = TRUE
         WHERE  "id" = $2 AND "sla_vencido" = FALSE`,
        [IncidenteEstado.VENCIDO, ticket.id],
      );

      await queryRunner.query(
        `INSERT INTO "historial_estados"
           ("id", "incidente_id", "estado_anterior", "estado_nuevo",
            "cambiado_por_usuario_id", "cambiado_en")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
        [
          ticket.id,
          IncidenteEstado.ABIERTO,
          IncidenteEstado.VENCIDO,
          this.sistemaAutomaticoUuid,
        ],
      );

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
      return;
    } finally {
      await queryRunner.release();
    }

    await this.notificarEscalamientos(ticket.id, ticket.politica_sla_id, ticket.titulo);
  }

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

    const telefonoDefault = this.configService.get<string>('P6_DEFAULT_TELEFONO');

    for (const regla of reglas) {
      const telefono = telefonoDefault;

      if (!telefono) {
        this.logger.warn(
          `SLA vencido en ${incidenteId}: sin teléfono para usuario ${regla.notificarAUsuarioId}. ` +
            'Configure P6_DEFAULT_TELEFONO.',
        );
        continue;
      }

      try {
        await this.p6NotificacionesService.enviarNotificacionMovilSlaVencido({
          telefono,
          incidenteId,
          titulo,
          usuarioDestinoId: regla.notificarAUsuarioId,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo notificar vía P6 móvil para el incidente ${incidenteId} (usuario: ${regla.notificarAUsuarioId})`,
          error,
        );
      }
    }
  }
}
