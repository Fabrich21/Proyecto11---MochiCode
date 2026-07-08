import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Incidente } from '../database/entities/incidente.entity';
import { IncidenteEstado, IP9EventoOperacionalCierre } from '@proyecto/shared-types';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { Comentario } from '../database/entities/comentario.entity';
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { SlaUtil } from '../common/utils/sla.util';
import { CreateIncidenteDto } from './dto/create-incidente.dto';
import { Sistema } from '../database/entities/sistema.entity';
import { AsignarIncidenteDto } from './dto/asignar-incidente.dto';
import { EventsGateway } from '../events/events.gateway';
import { P6NotificacionesService } from '../p6-notificaciones/p6-notificaciones.service';

@Injectable()
export class IncidentesService {
  private readonly logger = new Logger(IncidentesService.name);
  private readonly p9AnaliticaUrl: string;

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
    @InjectRepository(Comentario)
    private readonly comentarioRepository: Repository<Comentario>,
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
    private readonly httpService: HttpService,
    private readonly p6NotificacionesService: P6NotificacionesService,
    private readonly configService: ConfigService,
  ) {
    this.p9AnaliticaUrl = this.configService.get<string>(
      'P9_ANALITICA_URL',
      'http://p9-analitica/api/v1/ingesta/eventos-operacionales',
    )!;
  }

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
      return incidenteGuardado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cambiarEstado(id: string, updateDto: UpdateEstadoIncidenteDto) {
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
      historial.cambiadoPorUsuarioId = updateDto.usuarioId!;

      await queryRunner.manager.save(historial);

      await queryRunner.commitTransaction();

      this.eventsGateway.emitEstadoActualizado(incidente.id, updateDto.estado);

      if (updateDto.estado === IncidenteEstado.CERRADO) {
        await this.notificarCierreAP9(incidenteActualizado, updateDto.usuarioId!);
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

    const email =
      dto.email ?? this.configService.get<string>('P6_DEFAULT_EMAIL');

    if (email) {
      try {
        await this.p6NotificacionesService.enviarEmailAsignacionTicket({
          email,
          incidenteId: id,
          titulo: incidenteActualizado.titulo,
          asignadoAUsuarioId: dto.asignadoAUsuarioId,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo enviar email P6 al asignar incidente ${id}`,
          error,
        );
      }
    } else {
      this.logger.warn(
        `Asignación de ${id} sin email: configure dto.email o P6_DEFAULT_EMAIL.`,
      );
    }

    return incidenteActualizado;
  }

  private async notificarCierreAP9(incidente: Incidente, usuarioId: string): Promise<void> {
    const fechaResolucion = incidente.fechaResolucion ?? new Date();
    const mttrMinutos = this.calcularMttrMinutos(incidente.creadoEn, fechaResolucion);

    const payload: IP9EventoOperacionalCierre = {
      evento: 'Cierre',
      incidente_id: incidente.id,
      sistema_id: incidente.sistemaId,
      estado_final: incidente.estado,
      creado_en: incidente.creadoEn?.toISOString?.() ?? fechaResolucion.toISOString(),
      fecha_resolucion: fechaResolucion.toISOString(),
      mttr_minutos: mttrMinutos,
      sla_vencido: incidente.slaVencido,
      prioridad: incidente.prioridad,
    };

    try {
      await firstValueFrom(
        this.httpService.post(this.p9AnaliticaUrl, payload),
      );

      await this.registrarAuditoriaEventoP9(
        incidente.id,
        usuarioId,
        `Evento enviado a P09: Cierre (MTTR=${mttrMinutos} min).`,
      );

      this.logger.log(`Evento de cierre enviado a P09 para incidente ${incidente.id}.`);
    } catch (error) {
      await this.registrarAuditoriaEventoP9(
        incidente.id,
        usuarioId,
        `Fallo al enviar evento a P09: Cierre (MTTR=${mttrMinutos} min).`,
      );

      this.logger.error(
        `No se pudo enviar el evento de cierre a P09 para incidente ${incidente.id}`,
        error,
      );
    }
  }

  private async registrarAuditoriaEventoP9(
    incidenteId: string,
    usuarioId: string,
    descripcionAccion: string,
  ): Promise<void> {
    try {
      await this.auditoriaRepository.save({
        incidenteId,
        accionPorUsuarioId: usuarioId,
        descripcionAccion,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar auditoría de evento P09 para incidente ${incidenteId}`,
        error,
      );
    }
  }

  private calcularMttrMinutos(creadoEn: Date | undefined, fechaResolucion: Date): number {
    if (!creadoEn) {
      return 0;
    }

    const diferenciaMs = fechaResolucion.getTime() - creadoEn.getTime();
    return Math.max(0, Math.round(diferenciaMs / 60000));
  }

  async crearComentario(
    incidenteId: string,
    createComentarioDto: CreateComentarioDto,
    usuarioId: string,
  ): Promise<Comentario> {
    // Verificar que el incidente existe
    const incidente = await this.incidenteRepository.findOne({
      where: { id: incidenteId },
    });

    if (!incidente) {
      throw new NotFoundException(
        `Incidente con ID ${incidenteId} no encontrado`,
      );
    }

    // Crear el comentario
    const comentario = this.comentarioRepository.create({
      incidenteId,
      usuarioId,
      contenido: createComentarioDto.contenido,
    });

    const comentarioGuardado = await this.comentarioRepository.save(comentario);

    // Registrar auditoría
    await this.auditoriaRepository.save({
      incidenteId,
      accionPorUsuarioId: usuarioId,
      descripcionAccion: `Comentario agregado: "${createComentarioDto.contenido.substring(0, 50)}..."`,
    });

    // Emitir evento en tiempo real vía WebSocket
    this.eventsGateway.emitNuevoComentario(incidenteId, comentarioGuardado);

    this.logger.log(
      `Comentario creado en incidente ${incidenteId} por usuario ${usuarioId}`,
    );

    return comentarioGuardado;
  }

  async obtenerComentarios(incidenteId: string): Promise<Comentario[]> {
    // Verificar que el incidente existe
    const incidente = await this.incidenteRepository.findOne({
      where: { id: incidenteId },
    });

    if (!incidente) {
      throw new NotFoundException(
        `Incidente con ID ${incidenteId} no encontrado`,
      );
    }

    const comentarios = await this.comentarioRepository.find({
      where: { incidenteId },
      order: { creadoEn: 'ASC' },
    });

    return comentarios;
  }

  async eliminarComentario(
    incidenteId: string,
    comentarioId: string,
    usuarioId: string,
  ): Promise<void> {
    // Verificar que el incidente existe
    const incidente = await this.incidenteRepository.findOne({
      where: { id: incidenteId },
    });

    if (!incidente) {
      throw new NotFoundException(
        `Incidente con ID ${incidenteId} no encontrado`,
      );
    }

    // Obtener el comentario
    const comentario = await this.comentarioRepository.findOne({
      where: { id: comentarioId, incidenteId },
    });

    if (!comentario) {
      throw new NotFoundException(
        `Comentario con ID ${comentarioId} no encontrado en incidente ${incidenteId}`,
      );
    }

    // Solo el creador o un admin puede eliminar (por ahora solo verificamos que sea el creador)
    if (comentario.usuarioId !== usuarioId) {
      throw new Error(
        'Solo el creador del comentario puede eliminarlo',
      );
    }

    await this.comentarioRepository.delete(comentarioId);

    // Registrar auditoría
    await this.auditoriaRepository.save({
      incidenteId,
      accionPorUsuarioId: usuarioId,
      descripcionAccion: `Comentario eliminado: "${comentario.contenido.substring(0, 50)}..."`,
    });

    // Emitir evento en tiempo real vía WebSocket
    this.eventsGateway.emitComentarioEliminado(incidenteId, comentarioId);

    this.logger.log(
      `Comentario ${comentarioId} eliminado en incidente ${incidenteId} por usuario ${usuarioId}`,
    );
  }
}
