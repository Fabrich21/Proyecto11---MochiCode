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
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';
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
    const { page = 1, limit = 10, estado, sistema_id, orden = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.incidenteRepository.createQueryBuilder('incidente');

    if (estado) {
      queryBuilder.andWhere('incidente.estado = :estado', { estado });
    }

    if (sistema_id) {
      queryBuilder.andWhere('incidente.sistemaId = :sistema_id', { sistema_id });
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
      historial.cambiadoPorUsuarioId = updateDto.usuarioId;

      await queryRunner.manager.save(historial);

      await queryRunner.commitTransaction();

<<<<<<< HEAD
      this.eventsGateway.emitEstadoActualizado(incidente.id, updateDto.estado);
=======
      if (updateDto.estado === IncidenteEstado.CERRADO) {
        await this.notificarCierreAP9(incidenteActualizado, updateDto.usuarioId);
      }
>>>>>>> f2033a3fcd87911b979af9f389b65d695a33a313

      if (updateDto.estado === IncidenteEstado.CERRADO) {
        await this.notificarCierreAP9(incidenteActualizado, updateDto.usuarioId);
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
      auditoria.accionPorUsuarioId = dto.usuarioId;
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
}
