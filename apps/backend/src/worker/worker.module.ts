import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertasProcessor } from './worker.processor';
import { WorkerService } from './worker.service';
import { Sistema } from '../database/entities/sistema.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Incidente } from '../database/entities/incidente.entity';

@Module({
  imports: [
    // Registramos la misma cola que usa IngestionModule.
    // Aquí el rol es de CONSUMIDOR (antes era solo productor).
    BullModule.registerQueue({
      name: 'alertas-queue',
    }),

    // Registramos las entidades que el WorkerService necesita para leer/escribir.
    // TypeORM inyectará sus repositorios vía @InjectRepository().
    TypeOrmModule.forFeature([Sistema, PoliticaSla, Incidente]),
  ],
  providers: [
    AlertasProcessor, // BullMQ escucha la cola con este Processor
    WorkerService,    // Contiene la lógica de negocio y persistencia
  ],
})
export class WorkerModule {}
