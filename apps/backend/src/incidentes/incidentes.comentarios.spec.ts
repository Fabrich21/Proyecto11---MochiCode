import { Test, TestingModule } from '@nestjs/testing';
import { IncidentesService } from './incidentes.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Comentario } from '../database/entities/comentario.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Sistema } from '../database/entities/sistema.entity';
import { EventsGateway } from '../events/events.gateway';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { P6NotificacionesService } from '../p6-notificaciones/p6-notificaciones.service';
import { NotFoundException } from '@nestjs/common';
import { EventoAlerta } from '../database/entities/evento-alerta.entity';

describe('IncidentesService - Comentarios', () => {
  let service: IncidentesService;
  let comentarioRepository: jest.Mocked<Repository<Comentario>>;
  let incidenteRepository: jest.Mocked<Repository<Incidente>>;
  let auditoriaRepository: jest.Mocked<Repository<Auditoria>>;
  let eventsGateway: jest.Mocked<EventsGateway>;

  const incidenteId = '123e4567-e89b-12d3-a456-426614174000';
  const comentarioId = '223e4567-e89b-12d3-a456-426614174001';
  const usuarioId = 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentesService,
        {
          provide: getRepositoryToken(Incidente),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(HistorialEstado),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Comentario),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Auditoria),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(PoliticaSla),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Sistema),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(EventoAlerta),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn() },
        },
        {
          provide: EventsGateway,
          useValue: {
            emitNuevoComentario: jest.fn(),
            emitComentarioEliminado: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: { post: jest.fn() },
        },
        {
          provide: P6NotificacionesService,
          useValue: { enviarEmailAsignacionTicket: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<IncidentesService>(IncidentesService);
    comentarioRepository = module.get(getRepositoryToken(Comentario));
    incidenteRepository = module.get(getRepositoryToken(Incidente));
    auditoriaRepository = module.get(getRepositoryToken(Auditoria));
    eventsGateway = module.get(EventsGateway);
  });

  describe('crearComentario', () => {
    it('debe crear un comentario exitosamente', async () => {
      const incidente = { id: incidenteId } as Incidente;
      const nuevoComentario = {
        id: comentarioId,
        incidenteId,
        usuarioId,
        contenido: 'Comentario de prueba',
        creadoEn: new Date(),
      } as Comentario;

      incidenteRepository.findOne.mockResolvedValue(incidente);
      comentarioRepository.create.mockReturnValue(nuevoComentario);
      comentarioRepository.save.mockResolvedValue(nuevoComentario);
      auditoriaRepository.save.mockResolvedValue({} as any);

      const result = await service.crearComentario(incidenteId, {
        contenido: 'Comentario de prueba',
      }, usuarioId);

      expect(result).toEqual(nuevoComentario);
      expect(incidenteRepository.findOne).toHaveBeenCalledWith({
        where: { id: incidenteId },
      });
      expect(comentarioRepository.create).toHaveBeenCalledWith({
        incidenteId,
        usuarioId,
        contenido: 'Comentario de prueba',
      });
      expect(eventsGateway.emitNuevoComentario).toHaveBeenCalledWith(
        incidenteId,
        nuevoComentario,
      );
    });

    it('debe lanzar NotFoundException si el incidente no existe', async () => {
      incidenteRepository.findOne.mockResolvedValue(null);

      await expect(
        service.crearComentario(incidenteId, {
          contenido: 'Comentario de prueba',
        }, usuarioId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('obtenerComentarios', () => {
    it('debe obtener todos los comentarios de un incidente', async () => {
      const incidente = { id: incidenteId } as Incidente;
      const comentarios = [
        {
          id: comentarioId,
          incidenteId,
          usuarioId,
          contenido: 'Comentario 1',
          creadoEn: new Date(),
        } as Comentario,
      ];

      incidenteRepository.findOne.mockResolvedValue(incidente);
      comentarioRepository.find.mockResolvedValue(comentarios);

      const result = await service.obtenerComentarios(incidenteId);

      expect(result).toEqual(comentarios);
      expect(comentarioRepository.find).toHaveBeenCalledWith({
        where: { incidenteId },
        order: { creadoEn: 'ASC' },
      });
    });

    it('debe lanzar NotFoundException si el incidente no existe', async () => {
      incidenteRepository.findOne.mockResolvedValue(null);

      await expect(service.obtenerComentarios(incidenteId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('eliminarComentario', () => {
    it('debe eliminar un comentario exitosamente', async () => {
      const incidente = { id: incidenteId } as Incidente;
      const comentario = {
        id: comentarioId,
        incidenteId,
        usuarioId,
        contenido: 'Comentario de prueba',
        creadoEn: new Date(),
      } as Comentario;

      incidenteRepository.findOne.mockResolvedValue(incidente);
      comentarioRepository.findOne.mockResolvedValue(comentario);
      comentarioRepository.delete.mockResolvedValue({ affected: 1 } as any);
      auditoriaRepository.save.mockResolvedValue({} as any);

      await service.eliminarComentario(incidenteId, comentarioId, usuarioId);

      expect(comentarioRepository.delete).toHaveBeenCalledWith(comentarioId);
      expect(eventsGateway.emitComentarioEliminado).toHaveBeenCalledWith(
        incidenteId,
        comentarioId,
      );
    });

    it('debe lanzar error si el usuario no es el creador', async () => {
      const incidente = { id: incidenteId } as Incidente;
      const comentario = {
        id: comentarioId,
        incidenteId,
        usuarioId: 'otro-usuario-id',
        contenido: 'Comentario de prueba',
        creadoEn: new Date(),
      } as Comentario;

      incidenteRepository.findOne.mockResolvedValue(incidente);
      comentarioRepository.findOne.mockResolvedValue(comentario);

      await expect(
        service.eliminarComentario(incidenteId, comentarioId, usuarioId),
      ).rejects.toThrow('Solo el creador del comentario puede eliminarlo');
    });
  });
});
