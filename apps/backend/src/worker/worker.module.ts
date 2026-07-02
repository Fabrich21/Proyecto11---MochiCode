import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertasProcessor } from './worker.processor';
import { WorkerService } from './worker.service';
import { Sistema } from '../database/entities/sistema.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { PayloadNormalizerService } from '../ingestion/normalizer/payload-normalizer.service';
import { IngestionModule } from '../ingestion/ingestion.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'alertas-queue',
    }),
    TypeOrmModule.forFeature([Sistema, PoliticaSla, Incidente]),
    IngestionModule,
    EventsModule,
  ],
  providers: [
    AlertasProcessor,
    WorkerService,
    PayloadNormalizerService, // Normaliza payloads externos al esquema interno
  ],
})
export class WorkerModule {}
