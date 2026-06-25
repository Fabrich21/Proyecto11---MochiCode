import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestionModule } from './ingestion/ingestion.module';
import { WorkerModule } from './worker/worker.module';
import { IncidentesModule } from './incidentes/incidentes.module';
import { SlaModule } from './sla/sla.module';
import { HttpClientModule } from './common/http-client/http-client.module';
import { EventsModule } from './events/events.module';

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
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        return {
          type: 'postgres',
          ...(databaseUrl ? { url: databaseUrl } : {
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 5433),
            username: configService.get<string>('DB_USER', 'postgres'),
            password: configService.get<string>('DB_PASSWORD', 'postgres'),
            database: configService.get<string>('DB_NAME', 'proyecto11'),
          }),
          autoLoadEntities: true,
          synchronize: false,
          ssl: isProduction ? { rejectUnauthorized: false } : false,
        };
      },
    }),

    // Conexión Global a Cola de Mensajes (Redis)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        const redisUrl = configService.get<string>('REDIS_URL');
        
        // Extraemos partes de la URL manualmente si es Upstash (ya que BullMQ usa ioredis y le gusta tenerlos sueltos a veces, o podemos pasar toda la conexión)
        // Pero Ioredis puede aceptar un objeto de conexión o simplemente conectarse con un URL predeterminado usando una instancia externa. 
        // Afortunadamente, pasar la url en un objeto de conexión de bull/ioredis funciona perfecto así:
        
        if (redisUrl) {
          const url = new URL(redisUrl);
          return { 
            connection: { 
              host: url.hostname,
              port: parseInt(url.port || '6379', 10),
              username: url.username || 'default',
              password: url.password,
              tls: isProduction ? { rejectUnauthorized: false } : undefined,
              maxRetriesPerRequest: null 
            } 
          };
        }

        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            maxRetriesPerRequest: null,
          },
        };
      },
    }),

    // Scheduler global (requerido por SlaModule)
    ScheduleModule.forRoot(),

    // --- MÓDULOS DEL DOMINIO ---
    HttpClientModule, // Cliente HTTP resiliente para integraciones externas (P6, P9, P12)
    // Escudo antispam: Rate Limiting Global
    ThrottlerModule.forRoot([{
      ttl: 60000, // Una ventana de 60 segundos (1 minuto)
      limit: 100, // Máximo 100 peticiones por ventana
    }]),

    // --- MÓDULOS DEL DOMINIO ---
    IngestionModule,  // Capa de entrada: recibe alertas y las encola en Redis
    WorkerModule,     // Capa de procesamiento: desencola desde Redis y persiste en PostgreSQL
    IncidentesModule, // Capa de lectura: API para el frontend
    SlaModule,        // Tarea programada: detecta y procesa vencimientos de SLA cada 5 min
    EventsModule,     // WebSockets Gateway
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Activamos el escudo en todas las rutas del sistema por defecto
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}