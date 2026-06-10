import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Sistema } from '../database/entities/sistema.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { IncidenteEstado } from '@proyecto/shared-types';
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

    // Repositorios para consultas de lectura previas a la transacción
    @InjectRepository(Sistema)
    private readonly sistemaRepo: Repository<Sistema>,

    @InjectRepository(PoliticaSla)
    private readonly politicaSlaRepo: Repository<PoliticaSla>,
  ) {}

  /**
   * Método principal invocado por el Processor.
   *
   * Lógica del "ticket definitivo":
   *  - Si ya existe un incidente ABIERTO o EN_PROGRESO para el mismo sistema_id
   *    → se reutiliza ese ticket (deduplicación) y se agrega solo el evento.
   *  - Si no existe incidente activo
   *    → se crea el ticket nuevo + historial_estados inicial + auditoría.
   *  - En ambos casos se inserta el evento_alerta y la entrada de auditoría,
   *    todo dentro de una única transacción atómica.
   */
  async procesarAlerta(dto: CreateAlertaDto): Promise<void> {
    this.logger.log(`Procesando alerta del sistema: ${dto.sistema_id}`);

    // -----------------------------------------------------------------------
    // PASO 1: Validar que el sistema emisor esté registrado en BD.
    // Si no existe, lanzamos error para que BullMQ reintente el job.
    // -----------------------------------------------------------------------
    const sistema = await this.sistemaRepo.findOne({
      where: { sistemaId: dto.sistema_id },
    });

    if (!sistema) {
      throw new NotFoundException(
        `Sistema "${dto.sistema_id}" no está registrado en la BD. ` +
          `Reintentando en el próximo ciclo.`,
      );
    }

    // -----------------------------------------------------------------------
    // PASO 2: Buscar la política SLA por defecto (la más restrictiva).
    // En una iteración futura, el payload puede incluir "nivel_criticidad"
    // para seleccionar la política correcta de forma dinámica.
    // -----------------------------------------------------------------------
    const politicaSla = await this.politicaSlaRepo.findOne({
      where: {},
      order: { tiempoMaximoResolucionMinutos: 'ASC' },
    });

    if (!politicaSla) {
      throw new NotFoundException(
        'No hay políticas SLA definidas en la BD. ' +
          'Carga al menos una política antes de procesar alertas.',
      );
    }

    // -----------------------------------------------------------------------
    // PASO 3: Transacción atómica — toda la persistencia en una sola operación.
    // Si cualquier INSERT falla, se revierte TODO (no quedan datos huérfanos).
    // -----------------------------------------------------------------------
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const incidenteRepo = queryRunner.manager.getRepository(Incidente);

      // --- 3a. DEDUPLICACIÓN: buscar incidente activo para el mismo sistema ---
      // Un sistema puede generar múltiples alertas mientras el incidente sigue abierto.
      // En ese caso NO creamos un ticket duplicado; solo añadimos el evento al existente.
      const incidenteActivo = await incidenteRepo.findOne({
        where: {
          sistemaId: dto.sistema_id,
          estado: In([IncidenteEstado.ABIERTO, IncidenteEstado.EN_PROGRESO]),
        },
        order: { creadoEn: 'DESC' }, // El más reciente si hubiera varios (caso borde)
      });

      let incidenteId: string;

      if (incidenteActivo) {
        // ── RAMA A: ya existe ticket activo ──────────────────────────────────
        incidenteId = incidenteActivo.id;
        this.logger.log(
          `Incidente activo encontrado (${incidenteId}). ` +
            `Agregando evento sin crear ticket duplicado.`,
        );

        // Registrar en auditoría que llegó una nueva alerta al incidente existente
        await queryRunner.query(
          `INSERT INTO "auditoria"
             ("id", "incidente_id", "accion_por_usuario_id", "descripcion_accion", "creado_en")
           VALUES (gen_random_uuid(), $1, $2, $3, now())`,
          [
            incidenteId,                                                         // $1
            SISTEMA_AUTOMATICO_UUID,                                             // $2
            `Nueva alerta recibida desde ${dto.sistema_id} en incidente activo`, // $3
          ],
        );
      } else {
        // ── RAMA B: no hay ticket activo → crear uno nuevo ───────────────────

        // 3b. Insertar el incidente principal
        const titulo = `[${dto.sistema_id}] Alerta automática — ${new Date().toISOString()}`;
        const descripcion = `Payload inicial: ${JSON.stringify(dto.payload)}`;

        const nuevoIncidente = incidenteRepo.create({
          titulo,
          descripcion,
          estado: IncidenteEstado.ABIERTO,
          sistemaId: dto.sistema_id,
          creadorUsuarioId: SISTEMA_AUTOMATICO_UUID,
          politicaSlaId: politicaSla.id,
        });
        const incidenteGuardado = await incidenteRepo.save(nuevoIncidente);
        incidenteId = incidenteGuardado.id;

        // 3c. Registrar el estado inicial en historial_estados (hypertable).
        // estado_anterior = NULL porque el incidente nace directamente como ABIERTO.
        // Usamos SQL raw porque la tabla tiene PK compuesta (id + cambiado_en),
        // incompatible con el flujo estándar de repositorios TypeORM.
        await queryRunner.query(
          `INSERT INTO "historial_estados"
             ("id", "incidente_id", "estado_anterior", "estado_nuevo",
              "cambiado_por_usuario_id", "cambiado_en")
           VALUES (gen_random_uuid(), $1, NULL, $2, $3, now())`,
          [
            incidenteId,               // $1 — FK al incidente recién creado
            IncidenteEstado.ABIERTO,   // $2 — primer estado registrado
            SISTEMA_AUTOMATICO_UUID,   // $3 — actor: sistema automático
          ],
        );

        // 3d. Registrar la creación del ticket en auditoría
        await queryRunner.query(
          `INSERT INTO "auditoria"
             ("id", "incidente_id", "accion_por_usuario_id", "descripcion_accion", "creado_en")
           VALUES (gen_random_uuid(), $1, $2, $3, now())`,
          [
            incidenteId,                                                                  // $1
            SISTEMA_AUTOMATICO_UUID,                                                      // $2
            `Incidente creado automáticamente por alerta de ${dto.sistema_id}`,           // $3
          ],
        );

        this.logger.log(`Nuevo incidente creado con ID: ${incidenteId}`);
      }

      // --- 3e. INSERT evento_alerta (siempre, tanto en rama A como B) ---
      // Hypertable de TimescaleDB con PK compuesta (id + creado_en) → SQL raw obligatorio.
      await queryRunner.query(
        `INSERT INTO "eventos_alerta"
           ("id", "creado_en", "payload", "sistema_id", "incidente_id")
         VALUES (gen_random_uuid(), now(), $1::jsonb, $2, $3)`,
        [
          JSON.stringify(dto.payload), // $1 — payload JSONB
          dto.sistema_id,              // $2 — FK a sistemas
          incidenteId,                 // $3 — FK al incidente (nuevo o reutilizado)
        ],
      );

      // Confirmar toda la transacción
      await queryRunner.commitTransaction();

      this.logger.log(
        `✓ Alerta de ${dto.sistema_id} persistida correctamente ` +
          `en incidente ${incidenteId}`,
      );
    } catch (error) {
      // Revertir TODAS las operaciones si algo falló (no quedan datos huérfanos)
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `✗ Error al persistir alerta de ${dto.sistema_id}. Transacción revertida.`,
        error,
      );
      // Re-lanzamos para que BullMQ marque el job como fallido y lo reintente
      throw error;
    } finally {
      // Liberar siempre el QueryRunner, independientemente del resultado
      await queryRunner.release();
    }
  }
}

