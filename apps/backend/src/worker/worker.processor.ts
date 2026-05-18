import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WorkerService } from './worker.service';
import { CreateAlertaDto } from '../ingestion/dto/create-alerta.dto';

/**
 * Processor que escucha la cola "alertas-queue" de BullMQ (Redis).
 *
 * Flujo completo:
 *   [Proyecto externo] → POST /ingestion/alertas
 *      → IngestionService encola el job en Redis
 *         → AlertasProcessor desencola y procesa
 *            → WorkerService persiste en PostgreSQL
 *
 * Al extender WorkerHost, NestJS registra automáticamente este Processor
 * como consumidor de la cola indicada en el decorador @Processor.
 */
@Processor('alertas-queue')
export class AlertasProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertasProcessor.name);

  constructor(private readonly workerService: WorkerService) {
    super();
  }

  /**
   * Método process() es invocado automáticamente por BullMQ cada vez que
   * hay un job disponible en la cola.
   *
   * @param job - El trabajo recibido de Redis, cuyo data es el CreateAlertaDto
   *              encolado por IngestionService (campo "procesar-alerta").
   */
  async process(job: Job<CreateAlertaDto>): Promise<void> {
    this.logger.log(
      `Job recibido — ID: ${job.id} | Nombre: ${job.name} | Sistema: ${job.data.sistema_id}`,
    );

    // Delegamos toda la lógica de negocio y persistencia al WorkerService.
    // Si lanza una excepción, BullMQ marcará el job como fallido y lo reintentará
    // según la configuración de "attempts: 3" definida en IngestionService.
    await this.workerService.procesarAlerta(job.data);
  }
}
