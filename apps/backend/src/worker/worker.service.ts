import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Sistema } from '../database/entities/sistema.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Incidente, IncidenteEstado } from '../database/entities/incidente.entity';
import { CreateAlertaDto } from '../ingestion/dto/create-alerta.dto';

/**
 * UUID centinela para incidentes generados automáticamente por el sistema.
 * Representa al "actor sistema" cuando no hay un usuario humano que cree el ticket.
 * TODO: reemplazar por JWT.sub de P12 cuando la integración de auth esté completa.
 */
const SISTEMA_AUTOMATICO_UUID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    // DataSource nos da control total sobre transacciones (QueryRunner)
    private readonly dataSource: DataSource,

    // Repositorios para consultas de lectura (validación previa)
    @InjectRepository(Sistema)
    private readonly sistemaRepo: Repository<Sistema>,

    @InjectRepository(PoliticaSla)
    private readonly politicaSlaRepo: Repository<PoliticaSla>,
  ) {}

  /**
   * Método principal invocado por el Processor.
   * Orquesta todo el flujo: validación → transformación → persistencia transaccional.
   */
  async procesarAlerta(dto: CreateAlertaDto): Promise<void> {
    this.logger.log(`Procesando alerta del sistema: ${dto.sistema_id}`);

    // --- PASO 1: Validar que el sistema emisor esté registrado en BD ---
    // Si no existe, lanzamos NotFoundException para que BullMQ reintente el job.
    const sistema = await this.sistemaRepo.findOne({
      where: { sistemaId: dto.sistema_id },
    });

    if (!sistema) {
      throw new NotFoundException(
        `Sistema "${dto.sistema_id}" no está registrado en la BD. ` +
        `Reintentando en el próximo ciclo.`,
      );
    }

    // --- PASO 2: Buscar la política SLA por defecto ---
    // Toma la primera política disponible. En una iteración futura, el payload
    // podría incluir un campo "nivel_criticidad" para seleccionar la política correcta.
    const politicaSla = await this.politicaSlaRepo.findOne({
      where: {},
      order: { tiempoMaximoResolucionMinutos: 'ASC' }, // La más restrictiva primero
    });

    if (!politicaSla) {
      throw new NotFoundException(
        'No hay políticas SLA definidas en la BD. Carga al menos una política antes de procesar alertas.',
      );
    }

    // --- PASO 3: Persistencia transaccional (incidente + evento_alerta en una sola operación) ---
    // Un QueryRunner nos garantiza atomicidad: si falla cualquier INSERT, ambos se revierten.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3a. Generar datos del incidente a partir del payload recibido
      const titulo = `[${dto.sistema_id}] Alerta automática — ${new Date().toISOString()}`;
      const descripcion = `Payload recibido: ${JSON.stringify(dto.payload)}`;

      // 3b. Insertar el incidente en la tabla "incidentes"
      const incidenteRepo = queryRunner.manager.getRepository(Incidente);
      const nuevoIncidente = incidenteRepo.create({
        titulo,
        descripcion,
        estado: IncidenteEstado.ABIERTO,
        sistemaId: dto.sistema_id,
        creadorUsuarioId: SISTEMA_AUTOMATICO_UUID,
        politicaSlaId: politicaSla.id,
      });
      const incidenteGuardado = await incidenteRepo.save(nuevoIncidente);

      // 3c. Insertar el evento en la hypertable "eventos_alerta" via SQL raw.
      // Usamos SQL directo porque TypeORM no maneja bien las claves primarias compuestas
      // de los hypertables de TimescaleDB (PK: id + creado_en).
      await queryRunner.query(
        `INSERT INTO "eventos_alerta" ("id", "creado_en", "payload", "sistema_id", "incidente_id")
         VALUES (gen_random_uuid(), now(), $1::jsonb, $2, $3)`,
        [
          JSON.stringify(dto.payload), // $1 — payload JSONB
          dto.sistema_id,              // $2 — FK a sistemas
          incidenteGuardado.id,        // $3 — FK al incidente recién creado
        ],
      );

      // Si todo fue bien, confirmamos la transacción
      await queryRunner.commitTransaction();

      this.logger.log(
        `✓ Incidente creado con ID: ${incidenteGuardado.id} para sistema: ${dto.sistema_id}`,
      );
    } catch (error) {
      // Si algo falla, revertimos AMBAS operaciones para no dejar datos huérfanos
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `✗ Error al persistir alerta de ${dto.sistema_id}. Transacción revertida.`,
        error,
      );
      // Re-lanzamos para que BullMQ marque el job como fallido (y lo reintente)
      throw error;
    } finally {
      // Siempre liberamos el QueryRunner, independientemente del resultado
      await queryRunner.release();
    }
  }
}
