import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { IngestionController } from '../src/ingestion/ingestion.controller';
import { IngestionService } from '../src/ingestion/ingestion.service';

/**
 * Tests E2E — POST /api/v1/alertas
 *
 * La cola BullMQ se reemplaza por un mock: no se necesita Redis ni Docker.
 * Se prueba la capa HTTP completa: guard ZeroTrust, validación del DTO y
 * la respuesta 202 cuando el payload es correcto.
 */
describe('POST /api/v1/alertas (e2e)', () => {
  let app: INestApplication;

  // Mock de la cola: registra cada llamada para poder inspeccionarla
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-mock-001' }),
  };

  const VALID_PAYLOAD = {
    sistema_id: 'P1',
    payload: {
      sensor_id: 'TEMP-001',
      error: 'Temperatura fuera de rango',
      valor_actual: 8.5,
    },
  };

  beforeAll(async () => {
    // Construimos solo los providers necesarios, sin BullModule real
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        IngestionService,
        {
          provide: getQueueToken('alertas-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Replicamos la config de main.ts para que el comportamiento sea idéntico al real
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // CASO 1: Flujo feliz — sistema registrado con API Key correcta
  // ─────────────────────────────────────────────
  it('debería devolver 202 y "aceptado" con credenciales y payload válidos', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/alertas')
      .set('x-api-key', 'auth_p1_secret')
      .send(VALID_PAYLOAD);

    expect(response.status).toBe(202);
    expect(response.body.estado).toBe('aceptado');
    expect(response.body.sistema_origen).toBe('P1');
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'procesar-alerta',
      VALID_PAYLOAD,
      expect.objectContaining({ attempts: 3 }),
    );
  });

  // ─────────────────────────────────────────────
  // CASO 2: Sin header x-api-key → 401
  // ─────────────────────────────────────────────
  it('debería devolver 401 si falta el header x-api-key', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/alertas')
      .send(VALID_PAYLOAD);

    expect(response.status).toBe(401);
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // CASO 3: API Key incorrecta para el sistema → 401
  // ─────────────────────────────────────────────
  it('debería devolver 401 si la API Key no coincide con el sistema_id', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/alertas')
      .set('x-api-key', 'clave-incorrecta')
      .send(VALID_PAYLOAD);

    expect(response.status).toBe(401);
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // CASO 4: Sistema no registrado en el guard → 401
  // ─────────────────────────────────────────────
  it('debería devolver 401 si el sistema_id no está registrado en ZeroTrust', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/alertas')
      .set('x-api-key', 'auth_p1_secret')
      .send({ sistema_id: 'DESCONOCIDO', payload: { error: 'test' } });

    expect(response.status).toBe(401);
  });

  // ─────────────────────────────────────────────
  // CASO 5: Falta campo sistema_id → 400
  // ─────────────────────────────────────────────
  it('debería devolver 400 si falta sistema_id en el body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/alertas')
      .set('x-api-key', 'auth_p1_secret')
      .send({ payload: { error: 'sin sistema' } });

    expect(response.status).toBe(400);
  });

  // ─────────────────────────────────────────────
  // CASO 6: Falta campo payload → 400
  // ─────────────────────────────────────────────
  it('debería devolver 400 si falta el campo payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/alertas')
      .set('x-api-key', 'auth_p1_secret')
      .send({ sistema_id: 'P1' });

    expect(response.status).toBe(400);
  });
});
