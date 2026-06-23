import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { ReglaEscalamiento } from '../database/entities/regla-escalamiento.entity';
import { SlaService } from './sla.service';
import { SlaScheduler } from './sla.scheduler';

@Module({
  imports: [
    // Repositorios necesarios para la lógica de vencimiento y escalamiento
    TypeOrmModule.forFeature([Incidente, ReglaEscalamiento]),
    // HttpModule y ConfigModule son globales (HttpClientModule + ConfigModule.forRoot)
    // por lo que no necesitan importarse aquí explícitamente.
  ],
  providers: [
    SlaService,    // Lógica de detección y persistencia
    SlaScheduler,  // Cron que dispara SlaService cada 5 minutos
  ],
})
export class SlaModule {}
