import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WorkerService } from './worker.service';
import { Sistema } from '../database/entities/sistema.entity';
import { PoliticaSla } from '../database/entities/politica-sla.entity';
import { Incidente } from '../database/entities/incidente.entity';
import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../ingestion/dto/create-alerta.dto';
import { PayloadNormalizerService } from '../ingestion/normalizer/payload-normalizer.service';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const mockSistema: Partial<Sistema> = { sistemaId: 'P1', nombre: 'Sistema P1' };

const mockPolitica: Partial<PoliticaSla> = {
  id: 'sla-uuid-1',
  nombre: 'Crítico',
  tiempoMaximoResolucionMinutos: 60,
};

const incidenteActivo: Partial<Incidente> = {
  id: 'inc-existing-uuid',
  sistemaId: 'P1',
  estado: IncidenteEstado.ABIERTO,
};

const dto: CreateAlertaDto = {
  sistema_id: 'P1',
  creado_en: new Date().toISOString(),
  payload: { nivel: 'critico', mensaje: 'CPU > 90%' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mocks de infraestructura
// ─────────────────────────────────────────────────────────────────────────────
const mockIncidenteRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  query: jest.fn(),
  manager: {
    getRepository: jest.fn().mockReturnValue(mockIncidenteRepo),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

const mockSistemaRepo = { findOne: jest.fn() };
const mockPoliticaSlaRepo = { findOne: jest.fn() };

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────
describe('WorkerService', () => {
  let service: WorkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Sistema), useValue: mockSistemaRepo },
        { provide: getRepositoryToken(PoliticaSla), useValue: mockPoliticaSlaRepo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('mock-uuid-sistema-automatico') } },
        { provide: PayloadNormalizerService, useValue: { normalize: jest.fn().mockReturnValue({ prioridad: 'CRITICA', estadoSugerido: IncidenteEstado.ABIERTO }) } },
      ],
    }).compile();

    service = module.get<WorkerService>(WorkerService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Validaciones previas a la transacción (PASOS 1 y 2)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Validaciones previas a la transacción', () => {
    it('should throw NotFoundException when sistema is not registered in DB', async () => {
      // Arrange
      mockSistemaRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.procesarAlerta(dto)).rejects.toThrow(NotFoundException);
      await expect(service.procesarAlerta(dto)).rejects.toThrow('"P1" no está registrado');
    });

    it('should NOT start a transaction when sistema is not found', async () => {
      // Arrange
      mockSistemaRepo.findOne.mockResolvedValue(null);

      // Act
      await expect(service.procesarAlerta(dto)).rejects.toThrow(NotFoundException);

      // Assert — la transacción nunca debería abrirse
      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when no SLA policy exists', async () => {
      // Arrange
      mockSistemaRepo.findOne.mockResolvedValue(mockSistema);
      mockPoliticaSlaRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.procesarAlerta(dto)).rejects.toThrow(NotFoundException);
      await expect(service.procesarAlerta(dto)).rejects.toThrow('No hay políticas SLA');
    });

    it('should query sistema using sistemaId from dto', async () => {
      // Arrange
      mockSistemaRepo.findOne.mockResolvedValue(null);

      // Act
      await expect(service.procesarAlerta(dto)).rejects.toThrow();

      // Assert
      expect(mockSistemaRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sistemaId: 'P1' } }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Rama A — Incidente activo existe (deduplicación)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Rama A — incidente activo existe (deduplicación)', () => {
    beforeEach(() => {
      mockSistemaRepo.findOne.mockResolvedValue(mockSistema);
      mockPoliticaSlaRepo.findOne.mockResolvedValue(mockPolitica);
      mockIncidenteRepo.findOne.mockResolvedValue(incidenteActivo);
      mockQueryRunner.connect.mockResolvedValue(undefined);
      mockQueryRunner.startTransaction.mockResolvedValue(undefined);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      mockQueryRunner.release.mockResolvedValue(undefined);
    });

    it('should NOT create a new incidente when an active one already exists', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      expect(mockIncidenteRepo.create).not.toHaveBeenCalled();
      expect(mockIncidenteRepo.save).not.toHaveBeenCalled();
    });

    it('should insert an audit entry referencing the existing incidente', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert — al menos una llamada a query con "auditoria"
      const auditCall = mockQueryRunner.query.mock.calls.find(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('auditoria'),
      );
      expect(auditCall).toBeDefined();
    });

    it('should insert an evento_alerta with the correct sistema_id', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      const eventoCall = mockQueryRunner.query.mock.calls.find(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('eventos_alerta'),
      );
      expect(eventoCall).toBeDefined();
      expect(eventoCall[1]).toContain('P1');
    });

    it('should commit the transaction', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('should always release the queryRunner after success', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Rama B — No hay incidente activo (ticket nuevo)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Rama B — no hay incidente activo (ticket nuevo)', () => {
    const nuevoIncidente = { id: 'inc-new-uuid', sistemaId: 'P1', estado: IncidenteEstado.ABIERTO };

    beforeEach(() => {
      mockSistemaRepo.findOne.mockResolvedValue(mockSistema);
      mockPoliticaSlaRepo.findOne.mockResolvedValue(mockPolitica);
      mockIncidenteRepo.findOne.mockResolvedValue(null);
      mockIncidenteRepo.create.mockReturnValue(nuevoIncidente);
      mockIncidenteRepo.save.mockResolvedValue({ ...nuevoIncidente });
      mockQueryRunner.connect.mockResolvedValue(undefined);
      mockQueryRunner.startTransaction.mockResolvedValue(undefined);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      mockQueryRunner.release.mockResolvedValue(undefined);
    });

    it('should create and save a new incidente', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      expect(mockIncidenteRepo.create).toHaveBeenCalledTimes(1);
      expect(mockIncidenteRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should create incidente with ABIERTO state', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      expect(mockIncidenteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ estado: IncidenteEstado.ABIERTO }),
      );
    });

    it('should create incidente with the SLA policy id', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      expect(mockIncidenteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ politicaSlaId: 'sla-uuid-1' }),
      );
    });

    it('should insert historial_estados with estado ABIERTO', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      const historialCall = mockQueryRunner.query.mock.calls.find(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('historial_estados'),
      );
      expect(historialCall).toBeDefined();
      expect(historialCall[1]).toContain(IncidenteEstado.ABIERTO);
    });

    it('should insert an evento_alerta', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      const eventoCall = mockQueryRunner.query.mock.calls.find(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('eventos_alerta'),
      );
      expect(eventoCall).toBeDefined();
    });

    it('should commit the transaction', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('should release the queryRunner after committing', async () => {
      // Act
      await service.procesarAlerta(dto);

      // Assert
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Manejo de errores de transacción
  // ───────────────────────────────────────────────────────────────────────────
  describe('Manejo de errores de transacción', () => {
    beforeEach(() => {
      mockSistemaRepo.findOne.mockResolvedValue(mockSistema);
      mockPoliticaSlaRepo.findOne.mockResolvedValue(mockPolitica);
      mockIncidenteRepo.findOne.mockResolvedValue(null);
      mockIncidenteRepo.create.mockReturnValue({ id: 'inc-fail' });
      mockQueryRunner.connect.mockResolvedValue(undefined);
      mockQueryRunner.startTransaction.mockResolvedValue(undefined);
      mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
      mockQueryRunner.release.mockResolvedValue(undefined);
    });

    it('should rollback transaction when incidente.save throws', async () => {
      // Arrange
      mockIncidenteRepo.save.mockRejectedValue(new Error('DB constraint violation'));

      // Act
      await expect(service.procesarAlerta(dto)).rejects.toThrow('DB constraint violation');

      // Assert
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should rethrow the original error so BullMQ can retry', async () => {
      // Arrange
      const originalError = new Error('unique constraint failed');
      mockIncidenteRepo.save.mockRejectedValue(originalError);

      // Act & Assert
      await expect(service.procesarAlerta(dto)).rejects.toThrow('unique constraint failed');
    });

    it('should NOT commit when transaction fails', async () => {
      // Arrange
      mockIncidenteRepo.save.mockRejectedValue(new Error('fail'));

      // Act
      await expect(service.procesarAlerta(dto)).rejects.toThrow();

      // Assert
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should always release the queryRunner even when transaction fails', async () => {
      // Arrange
      mockIncidenteRepo.save.mockRejectedValue(new Error('fail'));

      // Act
      await expect(service.procesarAlerta(dto)).rejects.toThrow();

      // Assert — el finally garantiza el release
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback when query for events_alerta throws', async () => {
      // Arrange — save pasa pero el INSERT de eventos falla
      mockIncidenteRepo.save.mockResolvedValue({ id: 'inc-ok' });
      mockQueryRunner.query.mockRejectedValue(new Error('hypertable insert failed'));

      // Act
      await expect(service.procesarAlerta(dto)).rejects.toThrow('hypertable insert failed');

      // Assert
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
