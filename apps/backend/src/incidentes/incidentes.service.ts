import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { IncidenteEstado } from '@proyecto/shared-types';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { GetIncidentesDto } from './dto/get-incidentes.dto';
import { UpdateEstadoIncidenteDto } from './dto/update-estado-incidente.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class IncidentesService {
  constructor(
    @InjectRepository(Incidente)
    private readonly incidenteRepository: Repository<Incidente>,
    @InjectRepository(HistorialEstado)
    private readonly historialEstadoRepository: Repository<HistorialEstado>,
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async findAll(query: GetIncidentesDto) {
    const { page = 1, limit = 10, estado, sistema_id, orden = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.incidenteRepository.createQueryBuilder('incidente');

    // Filtros dinámicos
    if (estado) {
      queryBuilder.andWhere('incidente.estado = :estado', { estado });
    }

    if (sistema_id) {
      queryBuilder.andWhere('incidente.sistemaId = :sistema_id', { sistema_id });
    }

    // Ordenamiento y Paginación
    queryBuilder.orderBy('incidente.creadoEn', orden);
    queryBuilder.skip(skip).take(limit);

    // Ejecuta la consulta y cuenta los totales
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

      // Emitir evento WebSocket del cambio de estado
      this.eventsGateway.emitEstadoActualizado(incidente.id, updateDto.estado);

      return incidenteActualizado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}