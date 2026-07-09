import { Test, TestingModule } from '@nestjs/testing';
import { IncidentesService } from './incidentes.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { Comentario } from '../database/entities/comentario.entity';
import { DataSource } from 'typeorm';
import { IncidenteEstado } from '@proyecto/shared-types';
import { NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Sistema } from '../database/entities/sistema.entity';
import { EventsGateway } from '../events/events.gateway';
import { P6NotificacionesService } from '../p6-notificaciones/p6-notificaciones.service';

describe('IncidentesService', () => {
  let service: IncidentesService;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockIncidenteRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
  };

  const mockHistorialRepository = {};

  const mockComentarioRepository = {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockPoliticaSlaRepository = {
    findOne: jest.fn(),
  };

  const mockSistemaRepository = {
    findOne: jest.fn(),
  };

  // Emulamos las transacciones de TypeORM
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockEventsGateway = {
    emitEstadoActualizado: jest.fn(),
    emitIncidenteActualizado: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockP6NotificacionesService = {
    enviarEmailAsignacionTicket: jest.fn(),
    enviarEmailResolucionTicket: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'P9_ANALITICA_URL') {
        return 'http://p9-analitica/v1/events';
      }
      return defaultValue;
    }),
  };

  const mockAuditoriaRepository = {
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentesService,
        {
          provide: getRepositoryToken(Incidente),
          useValue: mockIncidenteRepository,
        },
        {
          provide: getRepositoryToken(HistorialEstado),
          useValue: mockHistorialRepository,
        },
        {
          provide: getRepositoryToken(Auditoria),
          useValue: mockAuditoriaRepository,
        },
        {
          provide: getRepositoryToken(PoliticaSla),
          useValue: mockPoliticaSlaRepository,
        },
        {
          provide: getRepositoryToken(Sistema),
          useValue: mockSistemaRepository,
        },
        {
          provide: getRepositoryToken(Comentario),
          useValue: mockComentarioRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: P6NotificacionesService,
          useValue: mockP6NotificacionesService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<IncidentesService>(IncidentesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('debería devolver datos y metadatos de paginación correctamente', async () => {
      const incidentesMock = [{ id: '1' }, { id: '2' }];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([incidentesMock, 2]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(mockIncidenteRepository.createQueryBuilder).toHaveBeenCalledWith('incidente');
      expect(result.data).toEqual(incidentesMock);
      expect(result.meta.total_registros).toBe(2);
      expect(result.meta.pagina_actual).toBe(1);
    });

    it('debería aplicar filtros de estado y sistema_id si se envían', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ estado: IncidenteEstado.ABIERTO, sistema_id: 'P08' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('incidente.estado = :estado', { estado: IncidenteEstado.ABIERTO });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('incidente.sistemaId = :sistema_id', { sistema_id: 'P08' });
    });

    it('debería filtrar por prioridad cuando se envía', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ prioridad: 'ALTA' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('incidente.prioridad = :prioridad', { prioridad: 'ALTA' });
    });

    it('debería filtrar por asignado_a cuando se envía', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      const userId = 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d';

      await service.findAll({ asignado_a: userId });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('incidente.asignadoAUsuarioId = :asignado_a', { asignado_a: userId });
    });

    it('debería filtrar por rango de fechas cuando se envían fecha_desde y fecha_hasta', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ fecha_desde: '2026-07-01T00:00:00Z', fecha_hasta: '2026-07-31T23:59:59Z' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('incidente.creadoEn >= :fecha_desde', { fecha_desde: '2026-07-01T00:00:00Z' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('incidente.creadoEn <= :fecha_hasta', { fecha_hasta: '2026-07-31T23:59:59Z' });
    });

    it('debería aplicar búsqueda de texto en titulo y descripcion cuando se envía q', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ q: 'pago' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(incidente.titulo ILIKE :q OR incidente.descripcion ILIKE :q)',
        { q: '%pago%' },
      );
    });

    it('no debería aplicar filtros opcionales cuando no se envían', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('obtenerEstado', () => {
    it('debería devolver el estado resumido del incidente', async () => {
      const mockIncidente = {
        id: 'inc-estado-1',
        titulo: 'Caída de servicio',
        sistemaId: 'P04',
        estado: IncidenteEstado.EN_PROGRESO,
        prioridad: 'ALTA',
        asignadoAUsuarioId: 'user-1',
        slaVencido: false,
        fechaLimiteResolucion: new Date('2026-07-08T20:00:00.000Z'),
        fechaResolucion: null,
        descripcion: 'Descripción del incidente',
        creadoEn: new Date('2026-07-08T16:00:00.000Z'),
      };
      mockIncidenteRepository.findOne.mockResolvedValue(mockIncidente);

      const result = await service.obtenerEstado('inc-estado-1');

      expect(mockIncidenteRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'inc-estado-1' },
      });
      expect(result).toEqual({
        ok: true,
        ticket: {
          id: 'inc-estado-1',
          asunto: 'Caída de servicio',
          estado: 'progreso',
          prioridad: 'alta',
          canal: 'email',
          cliente_id: null,
          cliente_nombre: null,
          agente_id: 'user-1',
          fecha_vencimiento_sla: '2026-07-08T20:00:00.000Z',
          pedido_id_ref: null,
          suscripcion_id_ref: null,
          pago_id_ref: null,
          salud_ref: null,
          resolucion: null,
          creado_en: '2026-07-08T16:00:00.000Z',
          actualizado_en: '2026-07-08T16:00:00.000Z',
        },
      });
    });

    it('debería lanzar NotFoundException si el incidente no existe', async () => {
      mockIncidenteRepository.findOne.mockResolvedValue(null);

      await expect(service.obtenerEstado('no-existe')).rejects.toMatchObject({
        response: { ok: false, message: 'Ticket no encontrado' },
        status: 404,
      });
    });
  });

  describe('create', () => {
    it('debería crear un incidente manual, historial y auditoría', async () => {
      const createDto = {
        titulo: 'Caida de servicio',
        descripcion: 'Errores 503 intermitentes',
        sistemaId: 'P04',
        creadorUsuarioId: 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d',
        prioridad: 'ALTA',
        estado: IncidenteEstado.ABIERTO,
      };
      const incidenteCreado = {
        id: 'inc-1',
        ...createDto,
        politicaSlaId: 'sla-1',
      };

      mockSistemaRepository.findOne.mockResolvedValue({ sistemaId: 'P04' });
      mockPoliticaSlaRepository.findOne.mockResolvedValue({
        id: 'sla-1',
        nombre: 'ALTA',
        tiempoMaximoResolucionMinutos: 240,
      });
      mockQueryRunner.manager.create.mockReturnValue({
        ...createDto,
        politicaSlaId: 'sla-1',
      });
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(incidenteCreado)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      mockHttpService.post.mockReturnValue(of({ data: { ok: true } }));

      const result = await service.create(createDto);

      expect(mockSistemaRepository.findOne).toHaveBeenCalledWith({ where: { sistemaId: 'P04' } });
      expect(mockPoliticaSlaRepository.findOne).toHaveBeenCalledWith({ where: { nombre: 'ALTA' } });
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Incidente,
        expect.objectContaining({
          titulo: createDto.titulo,
          sistemaId: createDto.sistemaId,
          creadorUsuarioId: createDto.creadorUsuarioId,
          politicaSlaId: 'sla-1',
        }),
      );
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(3);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://p9-analitica/v1/events',
        expect.objectContaining({
          source: 'incidents',
          event_type: 'incident_created',
          payload: expect.objectContaining({
            incident_id: 'inc-1',
            title: createDto.titulo,
            severity: 'high',
            status: 'open'
          })
        }),
      );

      expect(result).toEqual(incidenteCreado);
    });

    it('debería lanzar NotFoundException si el sistema no existe', async () => {
      mockSistemaRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          titulo: 'Caida de servicio',
          sistemaId: 'P04',
          creadorUsuarioId: 'f7b6d624-bcd8-4f44-b988-f1ce4f6fbb7d',
          prioridad: 'ALTA',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cambiarEstado', () => {
    it('debería lanzar NotFoundException si el incidente no existe', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.cambiarEstado('no-existe', { estado: IncidenteEstado.CERRADO, usuarioId: 'user1' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debería devolver el incidente sin hacer nada si el estado es exactamente el mismo', async () => {
      const mockIncidente = { id: '1', estado: IncidenteEstado.ABIERTO };
      mockQueryRunner.manager.findOne.mockResolvedValue(mockIncidente);

      const result = await service.cambiarEstado('1', { estado: IncidenteEstado.ABIERTO, usuarioId: 'user1' });

      expect(result).toEqual(mockIncidente);
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería actualizar el estado, notificar P09 y crear historial al cerrar', async () => {
      const mockIncidente = {
        id: '1',
        estado: IncidenteEstado.ABIERTO,
        sistemaId: 'P4',
        creadoEn: new Date('2026-06-28T00:00:00.000Z'),
        slaVencido: false,
        prioridad: 'ALTA',
      };
      const incidenteActualizado = {
        ...mockIncidente,
        estado: IncidenteEstado.CERRADO,
        fechaResolucion: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockIncidente);
      mockHttpService.post.mockReturnValue(of({ data: { ok: true } }));
      mockAuditoriaRepository.save.mockResolvedValue({ id: 'audit-1' });
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(incidenteActualizado)
        .mockResolvedValueOnce({});

      const result = await service.cambiarEstado('1', { estado: IncidenteEstado.CERRADO, usuarioId: 'user1' });

      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.estado).toBe(IncidenteEstado.CERRADO);
      expect(mockEventsGateway.emitEstadoActualizado).toHaveBeenCalledWith('1', IncidenteEstado.CERRADO);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://p9-analitica/v1/events',
        expect.objectContaining({
          source: 'incidents',
          event_type: 'incident_resolved',
          payload: expect.objectContaining({
            incident_id: '1',
            resolution_time_hours: expect.any(Number),
            sla_met: true,
          })
        }),
      );
      expect(mockAuditoriaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          incidenteId: '1',
          accionPorUsuarioId: 'user1',
          descripcionAccion: expect.stringContaining('Evento enviado a P09: incident_resolved'),
        }),
      );
    });

    it('debería calcular y enviar MTTR en minutos al cerrar un incidente', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-28T01:00:00.000Z'));

      const creadoEn = new Date('2026-06-28T00:00:00.000Z');
      const mockIncidente = {
        id: 'mttr-1',
        estado: IncidenteEstado.EN_PROGRESO,
        sistemaId: 'P8',
        creadoEn,
        slaVencido: false,
        prioridad: 'MEDIA',
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockIncidente);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ ...mockIncidente, estado: IncidenteEstado.CERRADO, fechaResolucion: new Date() })
        .mockResolvedValueOnce({});
      mockHttpService.post.mockReturnValue(of({ data: { ok: true } }));
      mockAuditoriaRepository.save.mockResolvedValue({ id: 'audit-2' });

      await service.cambiarEstado('mttr-1', { estado: IncidenteEstado.CERRADO, usuarioId: 'user1' });

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://p9-analitica/v1/events',
        expect.objectContaining({
          source: 'incidents',
          event_type: 'incident_resolved',
          payload: expect.objectContaining({
            incident_id: 'mttr-1',
            resolution_time_hours: 1,
            sla_met: true,
          })
        }),
      );

      jest.useRealTimers();
    });

    it('no debería fallar el cierre si el webhook de P09 retorna error', async () => {
      const mockIncidente = {
        id: 'error-webhook',
        estado: IncidenteEstado.EN_PROGRESO,
        sistemaId: 'P1',
        creadoEn: new Date('2026-06-28T00:00:00.000Z'),
        slaVencido: false,
        prioridad: 'ALTA',
      };
      const incidenteActualizado = {
        ...mockIncidente,
        estado: IncidenteEstado.CERRADO,
        fechaResolucion: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockIncidente);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(incidenteActualizado)
        .mockResolvedValueOnce({});
      mockHttpService.post.mockReturnValue(throwError(() => new Error('P09 unavailable')));
      mockAuditoriaRepository.save.mockResolvedValue({ id: 'audit-3' });

      const result = await service.cambiarEstado('error-webhook', { estado: IncidenteEstado.CERRADO, usuarioId: 'user1' });

      expect(result.estado).toBe(IncidenteEstado.CERRADO);
      expect(mockHttpService.post).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockAuditoriaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          incidenteId: 'error-webhook',
          accionPorUsuarioId: 'user1',
          descripcionAccion: expect.stringContaining('Fallo al enviar evento a P09: incident_resolved'),
        }),
      );
    });
  });

  describe('asignarIncidente', () => {
    it('debería asignar el ticket y notificar por email vía P6', async () => {
      const mockIncidente = { id: '1', titulo: 'Ticket test', asignadoAUsuarioId: undefined };
      const incidenteAsignado = {
        ...mockIncidente,
        asignadoAUsuarioId: 'user-asignado',
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockIncidente);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(incidenteAsignado)
        .mockResolvedValueOnce({});

      const result = await service.asignarIncidente('1', {
        asignadoAUsuarioId: 'user-asignado',
        usuarioId: 'user-admin',
        email: 'operador@test.com',
      });

      expect(result.asignadoAUsuarioId).toBe('user-asignado');
      expect(mockP6NotificacionesService.enviarEmailAsignacionTicket).toHaveBeenCalledWith({
        email: 'operador@test.com',
        incidenteId: '1',
        titulo: 'Ticket test',
        asignadoAUsuarioId: 'user-asignado',
      });
      expect(mockEventsGateway.emitIncidenteActualizado).toHaveBeenCalled();
    });
  });
});
