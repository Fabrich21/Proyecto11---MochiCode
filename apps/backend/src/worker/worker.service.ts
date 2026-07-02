import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Sistema } from '../database/entities/sistema.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../ingestion/dto/create-alerta.dto';
import { PayloadNormalizerService } from '../ingestion/normalizer/payload-normalizer.service';
import { SlaUtil } from '../common/utils/sla.util';
import { PriorityRulesEngine } from '../common/utils/priority-rules.engine';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private readonly sistemaAutomaticoUuid: string;

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Sistema)
    private readonly sistemaRepo: Repository<Sistema>,

    @InjectRepository(PoliticaSla)
    private readonly politicaSlaRepo: Repository<PoliticaSla>,

    private readonly normalizerService: PayloadNormalizerService,
     
    private readonly configService: ConfigService,
  ) {
    // Obtenemos el UUID desde las variables de entorno, usando el quemado como fallback por seguridad
    this.sistemaAutomaticoUuid = this.configService.get<string>(
      'SISTEMA_AUTOMATICO_UUID',
      '00000000-0000-0000-0000-000000000001',
    )!;
  }

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
    // PASO 0: Normalizar el payload externo al esquema interno.
    // -----------------------------------------------------------------------
    const normalizado = this.normalizerService.normalize(dto);
    this.logger.debug(
      `Normalizado — prioridad: ${normalizado.prioridad} | estado sugerido: ${normalizado.estadoSugerido}`,
    );

    // -----------------------------------------------------------------------
    // PASO 1: Validar que el sistema emisor esté registrado en BD.
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
    // PASO 2: Buscar la política SLA según prioridad.
    // El Motor de Reglas asigna la criticidad basado en el origen del webhook,
    // sobreescribiendo incondicionalmente cualquier prioridad del payload.
    // -----------------------------------------------------------------------
    const prioridadCalculada = PriorityRulesEngine.calcularPrioridad(dto.sistema_id, dto.payload);
    
    let politicaSla = await this.politicaSlaRepo.findOne({
      where: { nombre: prioridadCalculada },
    });

    if (!politicaSla) {
      this.logger.warn(`Política SLA para prioridad "${prioridadCalculada}" no encontrada. Usando la más restrictiva por defecto.`);
      politicaSla = await this.politicaSlaRepo.findOne({
        where: {},
        order: { tiempoMaximoResolucionMinutos: 'ASC' },
      });
    }

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
            this.sistemaAutomaticoUuid,                                          // $2
            `Nueva alerta recibida desde ${dto.sistema_id} en incidente activo`, // $3
          ],
        );
      } else {
        // ── RAMA B: no hay ticket activo → crear uno nuevo ───────────────────

        // 3b. Insertar el incidente principal
        const fechaCreacion = new Date();
        const titulo = normalizado.titulo;
        const descripcion = normalizado.descripcion;

        const fechaLimiteResolucion = SlaUtil.calcularFechaLimiteResolucion(
          fechaCreacion,
          politicaSla.tiempoMaximoResolucionMinutos
        );

        const nuevoIncidente = incidenteRepo.create({
           titulo,
           descripcion,
           estado: normalizado.estadoSugerido,
           prioridad: prioridadCalculada,
           sistemaId: dto.sistema_id,
           creadorUsuarioId: this.sistemaAutomaticoUuid,
           politicaSlaId: politicaSla.id,
           fechaLimiteResolucion,
        });
        const incidenteGuardado = await incidenteRepo.save(nuevoIncidente);
        incidenteId = Array.isArray(incidenteGuardado)
          ? incidenteGuardado[0].id
          : incidenteGuardado.id;

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
            normalizado.estadoSugerido,   // $2 — primer estado registrado
            this.sistemaAutomaticoUuid,   // $3 — actor: sistema automático
          ],
        );

        // 3d. Registrar la creación del ticket en auditoría
        await queryRunner.query(
          `INSERT INTO "auditoria"
             ("id", "incidente_id", "accion_por_usuario_id", "descripcion_accion", "creado_en")
           VALUES (gen_random_uuid(), $1, $2, $3, now())`,
          [
            incidenteId,                                                                  // $1
            this.sistemaAutomaticoUuid,                                                   // $2
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

