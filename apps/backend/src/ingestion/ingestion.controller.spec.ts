import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, InternalServerErrorException, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { ZeroTrustGuard } from '../common/guards/zero-trust/zero-trust.guard';

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Guard mockeado — verifica la capa HTTP del controlador de forma aislada
// ─────────────────────────────────────────────────────────────────────────────
describe('IngestionController — HTTP (guard mockeado)', () => {
  let app: INestApplication;

  const mockIngestionService = { encolarAlerta: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        { provide: IngestionService, useValue: mockIngestionService },
      ],
    })
      .overrideGuard(ZeroTrustGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());
  afterEach(() => jest.clearAllMocks());

  const validBody = { sistema_id: 'P1', payload: { nivel: 'critico' } };

  describe('POST /ingestion/alertas', () => {
    it('should return 202 and response body when payload is valid', async () => {
      // Arrange
      mockIngestionService.encolarAlerta.mockResolvedValue({
        estado: 'aceptado',
        mensaje: 'Alerta recibida y encolada para procesamiento asíncrono',
        sistema_origen: 'P1',
        timestamp: new Date().toISOString(),
      });

      // Act
      const res = await request(app.getHttpServer())
        .post('/ingestion/alertas')
        .send(validBody)
        .expect(202);

      // Assert
      expect(res.body.estado).toBe('aceptado');
      expect(res.body.sistema_origen).toBe('P1');
    });

    it('should call encolarAlerta with the request body', async () => {
      // Arrange
      mockIngestionService.encolarAlerta.mockResolvedValue({
        estado: 'aceptado',
        mensaje: 'ok',
        sistema_origen: 'P1',
        timestamp: new Date().toISOString(),
      });

      // Act
      await request(app.getHttpServer())
        .post('/ingestion/alertas')
        .send(validBody)
        .expect(202);

      // Assert
      expect(mockIngestionService.encolarAlerta).toHaveBeenCalledTimes(1);
      expect(mockIngestionService.encolarAlerta).toHaveBeenCalledWith(
        expect.objectContaining({ sistema_id: 'P1' }),
      );
    });

    it('should return 400 when sistema_id is missing', async () => {
      // Arrange — body incompleto
      await request(app.getHttpServer())
        .post('/ingestion/alertas')
        .send({ payload: { nivel: 'critico' } })
        .expect(400);
    });

    it('should return 400 when payload field is missing', async () => {
      await request(app.getHttpServer())
        .post('/ingestion/alertas')
        .send({ sistema_id: 'P1' })
        .expect(400);
    });

    it('should return 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .post('/ingestion/alertas')
        .send({})
        .expect(400);
    });

    it('should return 400 when payload is a string instead of object', async () => {
      await request(app.getHttpServer())
        .post('/ingestion/alertas')
        .send({ sistema_id: 'P1', payload: 'not-an-object' })
        .expect(400);
    });

    it('should return 500 when service throws InternalServerErrorException', async () => {
      // Arrange
      mockIngestionService.encolarAlerta.mockRejectedValue(
        new InternalServerErrorException('Error interno de infraestructura'),
      );

      // Act & Assert
      await request(app.getHttpServer())
        .post('/ingestion/alertas')
        .send(validBody)
        .expect(500);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Guard real — verifica que ZeroTrustGuard protege el endpoint
// ─────────────────────────────────────────────────────────────────────────────
describe('IngestionController — ZeroTrustGuard integrado', () => {
  let app: INestApplication;

  const mockService = { encolarAlerta: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [{ provide: IngestionService, useValue: mockService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());
  afterEach(() => jest.clearAllMocks());

  it('should return 401 when x-api-key header is missing', async () => {
    await request(app.getHttpServer())
      .post('/ingestion/alertas')
      .send({ sistema_id: 'P1', payload: { nivel: 'critico' } })
      .expect(401);
  });

  it('should return 401 when api key does not match sistema_id', async () => {
    await request(app.getHttpServer())
      .post('/ingestion/alertas')
      .set('x-api-key', 'wrong-key')
      .send({ sistema_id: 'P1', payload: { nivel: 'critico' } })
      .expect(401);
  });

  it('should return 401 when sistema_id is not registered (P99)', async () => {
    await request(app.getHttpServer())
      .post('/ingestion/alertas')
      .set('x-api-key', 'auth_p1_secret')
      .send({ sistema_id: 'P99', payload: { nivel: 'critico' } })
      .expect(401);
  });

  it('should return 202 when P1 sends valid credentials', async () => {
    // Arrange
    mockService.encolarAlerta.mockResolvedValue({
      estado: 'aceptado',
      mensaje: 'Alerta recibida',
      sistema_origen: 'P1',
      timestamp: new Date().toISOString(),
    });

    // Act & Assert
    await request(app.getHttpServer())
      .post('/ingestion/alertas')
      .set('x-api-key', 'auth_p1_secret')
      .send({ sistema_id: 'P1', payload: { nivel: 'critico' } })
      .expect(202);
  });

  it('should return 202 when P8 sends valid credentials', async () => {
    // Arrange
    mockService.encolarAlerta.mockResolvedValue({
      estado: 'aceptado',
      mensaje: 'Alerta recibida',
      sistema_origen: 'P8',
      timestamp: new Date().toISOString(),
    });

    // Act & Assert
    await request(app.getHttpServer())
      .post('/ingestion/alertas')
      .set('x-api-key', 'auth_p8_secret')
      .send({ sistema_id: 'P8', payload: { sensor: 'temp' } })
      .expect(202);
  });
});
