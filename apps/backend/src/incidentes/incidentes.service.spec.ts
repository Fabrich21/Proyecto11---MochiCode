import { Test, TestingModule } from '@nestjs/testing';
import { IncidentesService } from './incidentes.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Incidente } from '../database/entities/incidente.entity';
import { HistorialEstado } from '../database/entities/historial-estado.entity';
import { DataSource } from 'typeorm';
import { IncidenteEstado } from '@proyecto/shared-types';
import { NotFoundException } from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';
import { P6NotificacionesService } from '../p6-notificaciones/p6-notificaciones.service';
import { ConfigService } from '@nestjs/config';

describe('IncidentesService', () => {
  let service: IncidentesService;

  // Emulamos el comportamiento del QueryBuilder de TypeORM
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

  // Emulamos las transacciones de TypeORM
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

  const mockP6NotificacionesService = {
    enviarEmailAsignacionTicket: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
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
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
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
        service.cambiarEstado('no-existe', { estado: IncidenteEstado.CERRADO, usuarioId: 'user1' })
      ).rejects.toThrow(NotFoundException);

      // Si falla, debe hacer rollback obligatoriamente
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debería devolver el incidente sin hacer nada si el estado es exactamente el mismo', async () => {
      const mockIncidente = { id: '1', estado: IncidenteEstado.ABIERTO };
      mockQueryRunner.manager.findOne.mockResolvedValue(mockIncidente);

      const result = await service.cambiarEstado('1', { estado: IncidenteEstado.ABIERTO, usuarioId: 'user1' });

      expect(result).toEqual(mockIncidente);
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled(); // No debe guardar nada extra
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería actualizar el estado y crear el historial en BD si el estado cambia', async () => {
      const mockIncidente = { id: '1', estado: IncidenteEstado.ABIERTO };
      const incidenteActualizado = { ...mockIncidente, estado: IncidenteEstado.CERRADO, fechaResolucion: new Date() };
      
      mockQueryRunner.manager.findOne.mockResolvedValue(mockIncidente);
      
      // La primera vez que llame save() devuelve el incidente, la segunda el historial
      mockQueryRunner.manager.save.mockResolvedValueOnce(incidenteActualizado).mockResolvedValueOnce({});

      const result = await service.cambiarEstado('1', { estado: IncidenteEstado.CERRADO, usuarioId: 'user1' });

      // Verificamos que se guardaron ambas cosas en la transacción
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.estado).toBe(IncidenteEstado.CERRADO);
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
