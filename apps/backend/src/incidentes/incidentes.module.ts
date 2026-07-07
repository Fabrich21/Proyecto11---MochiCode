import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Sistema } from '../database/entities/sistema.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Incidente, HistorialEstado, Auditoria, PoliticaSla, Sistema])],
  controllers: [IncidentesController],
  providers: [IncidentesService],
})
export class IncidentesModule {}