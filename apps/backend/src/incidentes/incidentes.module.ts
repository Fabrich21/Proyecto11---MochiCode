import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';
import { Incidente } from '../database/entities/incidente.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Incidente])],
  controllers: [IncidentesController],
  providers: [IncidentesService],
})
export class IncidentesModule {}