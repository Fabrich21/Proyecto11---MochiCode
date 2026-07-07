import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { IncidenteEstado, IP9EventoOperacionalCierre } from '@proyecto/shared-types';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Auditoria } from '../database/entities/auditoria.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { SlaUtil } from '../common/utils/sla.util';
import { CreateIncidenteDto } from './dto/create-incidente.dto';
import { Sistema } from '../database/entities/sistema.entity';

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
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
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
      historial.cambiadoPorUsuarioId = updateDto.usuarioId;

      await queryRunner.manager.save(historial);

      await queryRunner.commitTransaction();

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