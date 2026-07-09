import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { IncidenteEstado } from '@proyecto/shared-types';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { SlaUtil } from '../common/utils/sla.util';
import { CreateIncidenteDto } from './dto/create-incidente.dto';
import { Sistema } from '../database/entities/sistema.entity';
import { AsignarIncidenteDto } from './dto/asignar-incidente.dto';
import { EventsGateway } from '../events/events.gateway';
import { PlaybooksService } from './playbooks.service';
import { IncidentesNotificationService } from './incidentes-notification.service';

@Injectable()
export class IncidentesService {
  private readonly logger = new Logger(IncidentesService.name);

  constructor(
    @InjectRepository(Incidente)
    private readonly incidenteRepository: Repository<Incidente>,
    @InjectRepository(HistorialEstado)
    private readonly historialEstadoRepository: Repository<HistorialEstado>,
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    @InjectRepository(PoliticaSla)
    private readonly politicaSlaRepository: Repository<PoliticaSla>,
    @InjectRepository(Sistema)
    private readonly sistemaRepository: Repository<Sistema>,
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
    private readonly playbooksService: PlaybooksService,
    private readonly incidentesNotificationService: IncidentesNotificationService,
  ) {}

  async findAll(query: GetIncidentesDto) {
    const {
      page = 1,
      limit = 10,
      estado,
      sistema_id,
      orden = 'DESC',
      prioridad,
      asignado_a,
      fecha_desde,
      fecha_hasta,
      q,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.incidenteRepository.createQueryBuilder('incidente')
      .leftJoinAndSelect('incidente.politicaSla', 'politicaSla');

    if (estado) {
      queryBuilder.andWhere('incidente.estado = :estado', { estado });
    }

    if (sistema_id) {
      queryBuilder.andWhere('incidente.sistemaId = :sistema_id', { sistema_id });
    }

    if (prioridad) {
      queryBuilder.andWhere('incidente.prioridad = :prioridad', { prioridad });
    }

    if (asignado_a) {
      queryBuilder.andWhere('incidente.asignadoAUsuarioId = :asignado_a', { asignado_a });
    }

    if (fecha_desde) {
      queryBuilder.andWhere('incidente.creadoEn >= :fecha_desde', { fecha_desde });
    }

    if (fecha_hasta) {
      queryBuilder.andWhere('incidente.creadoEn <= :fecha_hasta', { fecha_hasta });
    }

    if (q) {
      queryBuilder.andWhere(
        '(incidente.titulo ILIKE :q OR incidente.descripcion ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    queryBuilder.orderBy('incidente.creadoEn', orden);
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total_registros: total,
        pagina_actual: page,
        total_paginas: Math.ceil(total / limit),
        registros_por_pagina: limit,
      },
    };
  }

  async create(createDto: CreateIncidenteDto) {
    const sistema = await this.sistemaRepository.findOne({
      where: { sistemaId: createDto.sistemaId },
    });

    if (!sistema) {
      throw new NotFoundException(`Sistema con ID ${createDto.sistemaId} no encontrado`);
    }

    const politicaSla = await this.politicaSlaRepository.findOne({
      where: { nombre: createDto.prioridad },
    });

    if (!politicaSla) {
      throw new NotFoundException(`Politica SLA para prioridad ${createDto.prioridad} no encontrada`);
    }

    const fechaCreacion = new Date();
    const fechaLimiteResolucion = SlaUtil.calcularFechaLimiteResolucion(
      fechaCreacion,
      politicaSla.tiempoMaximoResolucionMinutos,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const incidente = queryRunner.manager.create(Incidente, {
        titulo: createDto.titulo,
        descripcion: createDto.descripcion,
        sistemaId: createDto.sistemaId,
        creadorUsuarioId: createDto.creadorUsuarioId,
        prioridad: createDto.prioridad,
        estado: createDto.estado ?? IncidenteEstado.ABIERTO,
        asignadoAUsuarioId: createDto.asignadoAUsuarioId,
        politicaSlaId: politicaSla.id,
        fechaLimiteResolucion,
      });

      const incidenteGuardado = await queryRunner.manager.save(Incidente, incidente);

      await queryRunner.manager.save(HistorialEstado, {
        incidenteId: incidenteGuardado.id,
        estadoNuevo: incidenteGuardado.estado,
        cambiadoPorUsuarioId: createDto.creadorUsuarioId,
      });

      await queryRunner.manager.save(Auditoria, {
        incidenteId: incidenteGuardado.id,
        accionPorUsuarioId: createDto.creadorUsuarioId,
        descripcionAccion: `Incidente creado manualmente para sistema ${createDto.sistemaId}`,
      });

      await queryRunner.commitTransaction();
      
      this.incidentesNotificationService.notificarEventoAP9(incidenteGuardado, createDto.creadorUsuarioId, 'incident_created').catch(err => {
        this.logger.error(`Error al notificar creación a P9 en background`, err);
      });

      return incidenteGuardado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cambiarEstado(id: string, updateDto: UpdateEstadoIncidenteDto, usuarioId?: string) {
    const actorId = updateDto.usuarioId || usuarioId;
    
    if (!actorId) {
       throw new Error('Usuario ID es requerido para cambiar estado');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const incidente = await queryRunner.manager.findOne(Incidente, { where: { id } });

      if (!incidente) {
        throw new NotFoundException(`Incidente con ID ${id} no encontrado`);
      }

      const estadoAnterior = incidente.estado;

      if (estadoAnterior === updateDto.estado) {
        await queryRunner.commitTransaction();
        return incidente;
      }

      incidente.estado = updateDto.estado;

      if (updateDto.estado === IncidenteEstado.CERRADO) {
        incidente.fechaResolucion = new Date();
      }

      const incidenteActualizado = await queryRunner.manager.save(incidente);

      const historial = new HistorialEstado();
      historial.incidenteId = incidente.id;
      historial.estadoAnterior = estadoAnterior;
      historial.estadoNuevo = updateDto.estado;
      historial.cambiadoPorUsuarioId = actorId;

      await queryRunner.manager.save(historial);

      await queryRunner.commitTransaction();

      this.eventsGateway.emitEstadoActualizado(incidente.id, updateDto.estado);

      const p9EventType = updateDto.estado === IncidenteEstado.CERRADO ? 'incident_resolved' : 'incident_status_changed';
      
      this.incidentesNotificationService.notificarEventoAP9(incidenteActualizado, actorId, p9EventType).catch(err => {
        this.logger.error(`Error al notificar cambio de estado a P9 en background`, err);
      });

      if (updateDto.estado === IncidenteEstado.CERRADO) {
        this.incidentesNotificationService.notificarResolucion(incidente).catch(err => {
            this.logger.error(`Error al notificar resolución en background`, err);
        });
      }

      return incidenteActualizado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async asignarIncidente(id: string, dto: AsignarIncidenteDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let incidenteActualizado: Incidente;

    try {
      const incidente = await queryRunner.manager.findOne(Incidente, { where: { id } });

      if (!incidente) {
        throw new NotFoundException(`Incidente con ID ${id} no encontrado`);
      }

      incidente.asignadoAUsuarioId = dto.asignadoAUsuarioId;
      incidenteActualizado = await queryRunner.manager.save(incidente);

      const auditoria = new Auditoria();
      auditoria.incidenteId = incidente.id;
      auditoria.accionPorUsuarioId = dto.usuarioId!;
      auditoria.descripcionAccion =
        `Ticket asignado al usuario ${dto.asignadoAUsuarioId}.`;

      await queryRunner.manager.save(auditoria);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    this.eventsGateway.emitIncidenteActualizado(id, {
      asignadoAUsuarioId: dto.asignadoAUsuarioId,
    });

    this.incidentesNotificationService.notificarAsignacion(incidenteActualizado, dto.email).catch(err => {
        this.logger.error(`Error al notificar asignación en background`, err);
    });

    return incidenteActualizado;
  }

  async obtenerPlaybook(id: string): Promise<string[]> {
    const incidente = await this.incidenteRepository.findOne({
      where: { id },
    });

    if (!incidente) {
      throw new NotFoundException(`Incidente con ID ${id} no encontrado`);
    }

    return this.playbooksService.obtenerPlaybookParaIncidente(incidente);
  }
}
