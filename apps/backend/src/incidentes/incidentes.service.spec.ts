import { Test, TestingModule } from '@nestjs/testing';
import { IncidentesService } from './incidentes.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { DataSource } from 'typeorm';
import { IncidenteEstado } from '@proyecto/shared-types';
import { NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
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
  };

  const mockHistorialRepository = {};

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
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
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'P9_ANALITICA_URL') {
        return 'http://p9-analitica/api/v1/ingesta/eventos-operacionales';
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
        'http://p9-analitica/api/v1/ingesta/eventos-operacionales',
        expect.objectContaining({
          evento: 'Cierre',
          incidente_id: '1',
          mttr_minutos: expect.any(Number),
        }),
      );
      expect(mockAuditoriaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          incidenteId: '1',
          accionPorUsuarioId: 'user1',
          descripcionAccion: expect.stringContaining('Evento enviado a P09: Cierre'),
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
        'http://p9-analitica/api/v1/ingesta/eventos-operacionales',
        expect.objectContaining({
          incidente_id: 'mttr-1',
          mttr_minutos: 60,
          evento: 'Cierre',
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

      mockQueryRunner.manager.findOne.mockResolvedValue(mockIncidente);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ ...mockIncidente, estado: IncidenteEstado.CERRADO, fechaResolucion: new Date() })
        .mockResolvedValueOnce({});
      mockHttpService.post.mockReturnValue(throwError(() => new Error('P09 unavailable')));
      mockAuditoriaRepository.save.mockResolvedValue({ id: 'audit-3' });

      await expect(
        service.cambiarEstado('error-webhook', { estado: IncidenteEstado.CERRADO, usuarioId: 'user1' }),
      ).resolves.toBeDefined();

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockAuditoriaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          incidenteId: 'error-webhook',
          accionPorUsuarioId: 'user1',
          descripcionAccion: expect.stringContaining('Fallo al enviar evento a P09: Cierre'),
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
