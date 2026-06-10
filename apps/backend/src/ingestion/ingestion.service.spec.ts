import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { IngestionService } from './ingestion.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';

describe('IngestionService', () => {
  let service: IngestionService;

  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: getQueueToken('alertas-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encolarAlerta()', () => {
    const dto: CreateAlertaDto = {
      sistema_id: 'P1',
      creado_en: new Date().toISOString(),
      payload: { nivel: 'alto', mensaje: 'CPU > 90%' },
    };

    it('should call queue.add with the correct job name, dto and options', async () => {
      // Arrange
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      // Act
      await service.encolarAlerta(dto);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith('procesar-alerta', dto, {
        removeOnComplete: true,
        attempts: 3,
      });
    });

    it('should return estado "aceptado" with correct sistema_origen', async () => {
      // Arrange
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      // Act
      const result = await service.encolarAlerta(dto);

      // Assert
      expect(result.estado).toBe('aceptado');
      expect(result.sistema_origen).toBe('P1');
      expect(result.mensaje).toContain('encolada');
      expect(result.timestamp).toBeDefined();
    });

    it('should return a timestamp in ISO format', async () => {
      // Arrange
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      // Act
      const result = await service.encolarAlerta(dto);

      // Assert
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('should throw InternalServerErrorException when queue.add rejects', async () => {
      // Arrange
      mockQueue.add.mockRejectedValue(new Error('Redis connection refused'));

      // Act & Assert
      await expect(service.encolarAlerta(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw with the infrastructure error message when queue fails', async () => {
      // Arrange
      mockQueue.add.mockRejectedValue(new Error('timeout'));

      // Act & Assert
      await expect(service.encolarAlerta(dto)).rejects.toThrow(
        'Error interno de infraestructura: No se pudo encolar la alerta.',
      );
    });

    it('should work with different sistema_id values', async () => {
      // Arrange
      mockQueue.add.mockResolvedValue({ id: 'job-2' });
      const dtoP8: CreateAlertaDto = { sistema_id: 'P8', creado_en: new Date().toISOString(), payload: { sensor: 'temp' } };

      // Act
      const result = await service.encolarAlerta(dtoP8);

      // Assert
      expect(result.sistema_origen).toBe('P8');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'procesar-alerta',
        dtoP8,
        expect.any(Object),
      );
    });
  });
});
