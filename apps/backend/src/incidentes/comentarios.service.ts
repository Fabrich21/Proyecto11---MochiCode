import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comentario } from '../database/entities/comentario.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ComentariosService {
  private readonly logger = new Logger(ComentariosService.name);

  constructor(
    @InjectRepository(Comentario)
    private readonly comentarioRepository: Repository<Comentario>,
    @InjectRepository(Incidente)
    private readonly incidenteRepository: Repository<Incidente>,
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async crearComentario(
    incidenteId: string,
    createComentarioDto: CreateComentarioDto,
    usuarioId: string,
  ): Promise<Comentario> {
    const incidente = await this.incidenteRepository.findOne({
      where: { id: incidenteId },
    });

    if (!incidente) {
      throw new NotFoundException(`Incidente con ID ${incidenteId} no encontrado`);
    }

    const comentario = this.comentarioRepository.create({
      incidenteId,
      usuarioId,
      contenido: createComentarioDto.contenido,
    });

    const comentarioGuardado = await this.comentarioRepository.save(comentario);

    await this.auditoriaRepository.save({
      incidenteId,
      accionPorUsuarioId: usuarioId,
      descripcionAccion: `Comentario agregado: "${createComentarioDto.contenido.substring(0, 50)}..."`,
    });

    this.eventsGateway.emitNuevoComentario(incidenteId, comentarioGuardado);
    this.logger.log(`Comentario creado en incidente ${incidenteId} por usuario ${usuarioId}`);

    return comentarioGuardado;
  }

  async obtenerComentarios(incidenteId: string): Promise<Comentario[]> {
    const incidente = await this.incidenteRepository.findOne({
      where: { id: incidenteId },
    });

    if (!incidente) {
      throw new NotFoundException(`Incidente con ID ${incidenteId} no encontrado`);
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
    const incidente = await this.incidenteRepository.findOne({
      where: { id: incidenteId },
    });

    if (!incidente) {
      throw new NotFoundException(`Incidente con ID ${incidenteId} no encontrado`);
    }

    const comentario = await this.comentarioRepository.findOne({
      where: { id: comentarioId, incidenteId },
    });

    if (!comentario) {
      throw new NotFoundException(
        `Comentario con ID ${comentarioId} no encontrado en incidente ${incidenteId}`,
      );
    }

    if (comentario.usuarioId !== usuarioId) {
      throw new Error('Solo el creador del comentario puede eliminarlo');
    }

    await this.comentarioRepository.delete(comentarioId);

    await this.auditoriaRepository.save({
      incidenteId,
      accionPorUsuarioId: usuarioId,
      descripcionAccion: `Comentario eliminado: "${comentario.contenido.substring(0, 50)}..."`,
    });

    this.eventsGateway.emitComentarioEliminado(incidenteId, comentarioId);
    this.logger.log(`Comentario ${comentarioId} eliminado en incidente ${incidenteId} por usuario ${usuarioId}`);
  }
}
