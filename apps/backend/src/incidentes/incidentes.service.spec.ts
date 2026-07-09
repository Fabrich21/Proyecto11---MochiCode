import { Test, TestingModule } from '@nestjs/testing';
import { IncidentesService } from './incidentes.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { DataSource } from 'typeorm';
import { IncidenteEstado } from '@proyecto/shared-types';
import { NotFoundException } from '@nestjs/common';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Sistema } from '../database/entities/sistema.entity';
import { EventsGateway } from '../events/events.gateway';
import { PlaybooksService } from './playbooks.service';
import { IncidentesNotificationService } from './incidentes-notification.service';

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
    find: jest.fn(),
  };

  const mockHistorialRepository = {};

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

  const mockAuditoriaRepository = {
    save: jest.fn(),
  };

  const mockIncidentesNotificationService = {
    notificarEventoAP9: jest.fn().mockResolvedValue(undefined),
    notificarResolucion: jest.fn().mockResolvedValue(undefined),
    notificarAsignacion: jest.fn().mockResolvedValue(undefined),
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
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: PlaybooksService,
          useValue: {
            obtenerPlaybookParaIncidente: jest.fn().mockReturnValue(['Paso 1']),
          },
        },
        {
          provide: IncidentesNotificationService,
          useValue: mockIncidentesNotificationService,
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
      
      expect(mockIncidentesNotificationService.notificarEventoAP9).toHaveBeenCalledWith(
        incidenteCreado,
        createDto.creadorUsuarioId,
        'incident_created'
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

    it('debería actualizar el estado y notificar P09 y resolución al cerrar', async () => {
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
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(incidenteActualizado)
        .mockResolvedValueOnce({});

      const result = await service.cambiarEstado('1', { estado: IncidenteEstado.CERRADO, usuarioId: 'user1' });

      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.estado).toBe(IncidenteEstado.CERRADO);
      expect(mockEventsGateway.emitEstadoActualizado).toHaveBeenCalledWith('1', IncidenteEstado.CERRADO);
      
      expect(mockIncidentesNotificationService.notificarEventoAP9).toHaveBeenCalledWith(
        incidenteActualizado,
        'user1',
        'incident_resolved'
      );
      
      expect(mockIncidentesNotificationService.notificarResolucion).toHaveBeenCalledWith(mockIncidente);
    });
  });

  describe('asignarIncidente', () => {
    it('debería asignar el ticket y notificar por email', async () => {
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
      expect(mockIncidentesNotificationService.notificarAsignacion).toHaveBeenCalledWith(
        incidenteAsignado,
        'operador@test.com'
      );
      expect(mockEventsGateway.emitIncidenteActualizado).toHaveBeenCalled();
    });
  });
});
