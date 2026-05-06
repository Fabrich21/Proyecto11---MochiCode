import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateAlertaDto } from './dto/create-alerta.dto';

@Injectable()
export class IngestionService {
  // Instanciamos el Logger nativo para ver los errores en la terminal
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectQueue('alertas-queue') private readonly alertasQueue: Queue,
  ) {}

  async encolarAlerta(createAlertaDto: CreateAlertaDto) {
    try {
      // Empujamos el payload a Redis. 
      // 'procesar-alerta' es el nombre del Job que configuraremos en el siguiente sprint.
      await this.alertasQueue.add('procesar-alerta', createAlertaDto, {
        removeOnComplete: true, // Buena práctica: borra el trabajo de Redis una vez procesado para no llenar la RAM
        attempts: 3,            // Resiliencia: si el procesamiento falla a futuro, reintentará 3 veces
      });
      
      return {
        estado: 'aceptado',
        mensaje: 'Alerta recibida y encolada para procesamiento asíncrono',
        sistema_origen: createAlertaDto.sistema_id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Fallo al encolar alerta proveniente de ${createAlertaDto.sistema_id}`, error);
      
      // Si la conexión a Redis falla, abortamos el 202 y lanzamos un Error 500.
      throw new InternalServerErrorException('Error interno de infraestructura: No se pudo encolar la alerta.');
    }
  }
}