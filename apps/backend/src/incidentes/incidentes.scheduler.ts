import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IncidentesSyncService } from './incidentes-sync.service';

/**
 * Tarea programada que sincroniza el estado de los incidentes originados por
 * CRM (P07) con el estado real reportado por el sistema externo.
 *
 * Frecuencia: cada 5 minutos.
 */
@Injectable()
export class IncidentesScheduler {
  private readonly logger = new Logger(IncidentesScheduler.name);

  constructor(private readonly incidentesSyncService: IncidentesSyncService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'sincronizacion-estados-crm',
    timeZone: 'America/Santiago',
  })
  async ejecutarSincronizacionCrm(): Promise<void> {
    this.logger.log('Cron CRM iniciado — sincronizando estados de incidentes P07...');
    const resultado = await this.incidentesSyncService.sincronizarEstadosDesdeCrm();
    this.logger.log(
      `Cron CRM finalizado. Revisados: ${resultado.revisados}, actualizados: ${resultado.actualizados}.`,
    );
  }
}
