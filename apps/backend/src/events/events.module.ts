import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Module({
  providers: [EventsGateway],
  exports: [EventsGateway], // Exportamos para inyectarlo en el Worker y en Incidentes
})
export class EventsModule {}
