import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestionModule } from './ingestion/ingestion.module';
import { WorkerModule } from './worker/worker.module';
import { IncidentesModule } from './incidentes/incidentes.module'; // <-- Nueva importación

@Module({
  imports: [
// <-- MODIFICACIÓN APLICADA AQUÍ
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '../../.env', // Le indicamos que el .env está en la raíz del monorepo
    }),
    
    // Conexión a Base de Datos (PostgreSQL + TimescaleDB)
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5433),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'proyecto11'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    // Conexión Global a Cola de Mensajes (Redis)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    // --- MÓDULOS DEL DOMINIO ---
    IngestionModule,  // Capa de entrada: recibe alertas y las encola en Redis
    WorkerModule,     // Capa de procesamiento: desencola desde Redis y persiste en PostgreSQL
    IncidentesModule, // <-- Capa de lectura: API para el frontend (Filtros y Paginación)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}