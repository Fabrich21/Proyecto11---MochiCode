import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    // Registramos el "buzón" específico para las alertas
    BullModule.registerQueue({
      name: 'alertas-queue',
    }),
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}