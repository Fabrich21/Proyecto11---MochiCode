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
import { EventsGateway } from '../events/events.gateway';

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

    private readonly eventsGateway: EventsGateway,

    private readonly configService: ConfigService,
  ) {
    this.sistemaAutomaticoUuid = this.configService.get<string>(
      'SISTEMA_AUTOMATICO_UUID',
      '00000000-0000-0000-0000-000000000001',
    )!;
  }

  async procesarAlerta(dto: CreateAlertaDto): Promise<void> {
    this.logger.log('Procesando alerta del sistema: ' + dto.sistema_id);

    const normalizado = this.normalizerService.normalize(dto);
    this.logger.debug(
      'Normalizado - prioridad: ' +
        normalizado.prioridad +
        ' | estado sugerido: ' +
        normalizado.estadoSugerido,
    );

    const sistema = await this.sistemaRepo.findOne({
      where: { sistemaId: dto.sistema_id },
    });

    if (!sistema) {
      throw new NotFoundException(
        'Sistema "' +
          dto.sistema_id +
          '" no está registrado en la BD. Reintentando en el próximo ciclo.',
      );
    }

    const prioridadCalculada = PriorityRulesEngine.calcularPrioridad(
      dto.sistema_id,
      dto.payload,
    );

    let politicaSla = await this.politicaSlaRepo.findOne({
      where: { nombre: prioridadCalculada },
    });

    if (!politicaSla) {
      this.logger.warn(
        'Política SLA para prioridad "' +
          prioridadCalculada +
          '" no encontrada. Usando la más restrictiva por defecto.',
      );

      politicaSla = await this.politicaSlaRepo.findOne({
        where: {},
        order: { tiempoMaximoResolucionMinutos: 'ASC' },
      });
    }

    if (!politicaSla) {
      throw new NotFoundException(
        'No hay políticas SLA definidas en la BD. Carga al menos una política antes de procesar alertas.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let incidenteCreadoParaBroadcast: Incidente | null = null;

    try {
      const incidenteRepo = queryRunner.manager.getRepository(Incidente);

      const incidenteActivo = await incidenteRepo.findOne({
        where: {
          sistemaId: dto.sistema_id,
          titulo: normalizado.titulo, // Deduplicación fina (ej: 1 ticket por sensor/falla)
          estado: In([IncidenteEstado.ABIERTO, IncidenteEstado.EN_PROGRESO]),
        },
        order: { creadoEn: 'DESC' },
      });

      let incidenteId: string;

      if (incidenteActivo) {
        incidenteId = incidenteActivo.id;
        this.logger.log(
          'Incidente activo encontrado (' +
            incidenteId +
            '). Agregando evento sin crear ticket duplicado.',
        );

        if (normalizado.estadoSugerido === IncidenteEstado.CERRADO && incidenteActivo.estado !== IncidenteEstado.CERRADO) {
          await queryRunner.query(
            `UPDATE "incidentes" SET "estado" = $1, "fecha_resolucion" = now() WHERE "id" = $2`,
            [IncidenteEstado.CERRADO, incidenteId]
          );

          await queryRunner.query(
            'INSERT INTO "historial_estados" ("id", "incidente_id", "estado_anterior", "estado_nuevo", "cambiado_por_usuario_id", "cambiado_en") VALUES (gen_random_uuid(), $1, $2, $3, $4, now())',
            [
              incidenteId,
              incidenteActivo.estado,
              IncidenteEstado.CERRADO,
              this.sistemaAutomaticoUuid,
            ]
          );
          
          this.eventsGateway.emitEstadoActualizado(incidenteId, IncidenteEstado.CERRADO);
          
          this.logger.log(`Incidente ${incidenteId} CERRADO automáticamente por evento de resolución.`);
        }

        await queryRunner.query(
          'INSERT INTO "auditoria" ("id", "incidente_id", "accion_por_usuario_id", "descripcion_accion", "creado_en") VALUES (gen_random_uuid(), $1, $2, $3, now())',
          [
            incidenteId,
            this.sistemaAutomaticoUuid,
            'Nueva alerta recibida desde ' + dto.sistema_id + ' en incidente activo',
          ],
        );
      } else {
        const fechaCreacion = new Date();
        const titulo = normalizado.titulo;
        const descripcion = normalizado.descripcion;

        const fechaLimiteResolucion = SlaUtil.calcularFechaLimiteResolucion(
          fechaCreacion,
          politicaSla.tiempoMaximoResolucionMinutos,
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
        incidenteCreadoParaBroadcast = Array.isArray(incidenteGuardado)
          ? incidenteGuardado[0]
          : incidenteGuardado;

        await queryRunner.query(
          'INSERT INTO "historial_estados" ("id", "incidente_id", "estado_anterior", "estado_nuevo", "cambiado_por_usuario_id", "cambiado_en") VALUES (gen_random_uuid(), $1, NULL, $2, $3, now())',
          [
            incidenteId,
            normalizado.estadoSugerido,
            this.sistemaAutomaticoUuid,
          ],
        );

        await queryRunner.query(
          'INSERT INTO "auditoria" ("id", "incidente_id", "accion_por_usuario_id", "descripcion_accion", "creado_en") VALUES (gen_random_uuid(), $1, $2, $3, now())',
          [
            incidenteId,
            this.sistemaAutomaticoUuid,
            'Incidente creado automáticamente por alerta de ' + dto.sistema_id,
          ],
        );

        this.logger.log('Nuevo incidente creado con ID: ' + incidenteId);
      }

      await queryRunner.query(
        'INSERT INTO "eventos_alerta" ("id", "creado_en", "payload", "sistema_id", "incidente_id") VALUES (gen_random_uuid(), now(), $1::jsonb, $2, $3)',
        [
          JSON.stringify(dto.payload),
          dto.sistema_id,
          incidenteId,
        ],
      );

      await queryRunner.commitTransaction();

      if (incidenteCreadoParaBroadcast) {
        this.eventsGateway.emitNuevoIncidente(incidenteCreadoParaBroadcast);
      }

      this.logger.log(
        'Alerta de ' +
          dto.sistema_id +
          ' persistida correctamente en incidente ' +
          incidenteId,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error al persistir alerta de ' + dto.sistema_id + '. Transacción revertida.',
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
