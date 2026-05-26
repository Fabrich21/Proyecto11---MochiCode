import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { GetIncidentesDto } from './dto/get-incidentes.dto';

@Injectable()
export class IncidentesService {
  constructor(
    @InjectRepository(Incidente)
    private readonly incidenteRepository: Repository<Incidente>,
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
}