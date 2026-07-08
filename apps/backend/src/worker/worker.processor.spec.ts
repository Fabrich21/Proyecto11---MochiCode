import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AlertasProcessor } from './worker.processor';
import { WorkerService } from './worker.service';
import { CreateAlertaDto } from '../ingestion/dto/create-alerta.dto';

describe('AlertasProcessor', () => {
  let processor: AlertasProcessor;

  const mockWorkerService = { procesarAlerta: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertasProcessor,
        { provide: WorkerService, useValue: mockWorkerService },
        // BullMQ inyecta la queue internamente; mock mínimo para satisfacer el DI
        { provide: getQueueToken('alertas-queue'), useValue: {} },
      ],
    }).compile();

    processor = module.get<AlertasProcessor>(AlertasProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process()', () => {
    const dto: CreateAlertaDto = {
      sistema_id: 'P1',
      creado_en: new Date().toISOString(),
      payload: { nivel: 'alto', sensor: 'cpu' },
    };

    const buildJob = (data: CreateAlertaDto): Job<CreateAlertaDto> =>
      ({ id: 'job-123', name: 'procesar-alerta', data }) as unknown as Job<CreateAlertaDto>;

    it('should call workerService.procesarAlerta with the job data', async () => {
      // Arrange
      mockWorkerService.procesarAlerta.mockResolvedValue(undefined);

      // Act
      await processor.process(buildJob(dto));

      // Assert
      expect(mockWorkerService.procesarAlerta).toHaveBeenCalledTimes(1);
      expect(mockWorkerService.procesarAlerta).toHaveBeenCalledWith(dto);
    });

    it('should resolve without returning a value on success (void)', async () => {
      // Arrange
      mockWorkerService.procesarAlerta.mockResolvedValue(undefined);

      // Act
      const result = await processor.process(buildJob(dto));

      // Assert
      expect(result).toBeUndefined();
    });

    it('should propagate the error when workerService.procesarAlerta throws', async () => {
      // Arrange — BullMQ capturará este error y reintentará el job
      const dbError = new Error('DB connection lost');
      mockWorkerService.procesarAlerta.mockRejectedValue(dbError);

      // Act & Assert
      await expect(processor.process(buildJob(dto))).rejects.toThrow('DB connection lost');
    });

    it('should propagate NotFoundException from workerService', async () => {
      // Arrange
      const { NotFoundException } = await import('@nestjs/common');
      mockWorkerService.procesarAlerta.mockRejectedValue(
        new NotFoundException('Sistema "P99" no está registrado'),
      );

      // Act & Assert
      await expect(processor.process(buildJob({ sistema_id: 'P99', creado_en: new Date().toISOString(), payload: {} }))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should pass the full dto including payload to procesarAlerta', async () => {
      // Arrange
      mockWorkerService.procesarAlerta.mockResolvedValue(undefined);
      const richDto: CreateAlertaDto = { sistema_id: 'P1', creado_en: new Date().toISOString(), payload: { temp: 95, unit: 'C' } };

      // Act
      await processor.process(buildJob(richDto));

      // Assert
      expect(mockWorkerService.procesarAlerta).toHaveBeenCalledWith(
        expect.objectContaining({ sistema_id: 'P1', payload: { temp: 95, unit: 'C' } }),
      );
    });
  });
});
