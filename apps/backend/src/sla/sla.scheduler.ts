import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlaService } from './sla.service';

/**
 * Tarea programada que dispara la detección de vencimientos SLA.
 *
 * Frecuencia: cada 5 minutos.
 * Esto significa que un ticket puede tardar hasta 5 minutos adicionales
 * en ser marcado como VENCIDO después de cruzar el umbral — aceptable
 * para cualquier política SLA > 10 minutos.
 *
 * Para afinar la precisión basta con cambiar el CronExpression.
 */
@Injectable()
export class SlaScheduler {
  private readonly logger = new Logger(SlaScheduler.name);

  constructor(private readonly slaService: SlaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'sla-vencimientos',
    timeZone: 'America/Santiago', // UTC-4 (Chile Continental)
  })
  async ejecutarRevisionSla(): Promise<void> {
    this.logger.log('Cron SLA iniciado — revisando vencimientos...');
    await this.slaService.detectarYProcesarVencimientos();
    this.logger.log('Cron SLA finalizado.');
  }
}
