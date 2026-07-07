import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sistema } from '../database/entities/sistema.entity';

export type SistemaOption = {
  id: string;
  nombre: string;
  descripcion: string | null;
};

@Injectable()
export class SistemasService {
  constructor(
    @InjectRepository(Sistema)
    private readonly sistemasRepository: Repository<Sistema>,
  ) {}

  async findAll(): Promise<SistemaOption[]> {
    const sistemas = await this.sistemasRepository.find({
      order: { sistemaId: 'ASC' },
    });

    return sistemas.map((sistema) => ({
      id: sistema.sistemaId,
      nombre: sistema.nombre,
      descripcion: sistema.descripcion ?? null,
    }));
  }
}