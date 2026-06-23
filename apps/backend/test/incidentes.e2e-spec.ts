import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentesController } from '../src/incidentes/incidentes.controller';
import { IncidentesService } from '../src/incidentes/incidentes.service';
import { Incidente } from '../src/database/entities/incidente.entity';
import { IncidenteEstado } from '@proyecto/shared-types';

/**
 * Tests E2E — GET /api/v1/incidentes
 *
 * El repositorio TypeORM se reemplaza por un mock: no se necesita PostgreSQL.
 * Se prueba la paginación, los filtros dinámicos y la validación del DTO de query.
 */
describe('GET /api/v1/incidentes (e2e)', () => {
  let app: INestApplication;

  // ─── Datos de prueba ───────────────────────────────────────────────────
  const incidentesMock: Partial<Incidente>[] = [
    {
      id: 'uuid-001',
      titulo: 'Falla sensor IoT',
      estado: IncidenteEstado.ABIERTO,
      creadoEn: new Date('2026-06-01T10:00:00Z'),
    },
    {
      id: 'uuid-002',
      titulo: 'Error pasarela pagos',
      estado: IncidenteEstado.EN_PROGRESO,
      creadoEn: new Date('2026-06-02T12:00:00Z'),
    },
  ];

  // ─── Mock del QueryBuilder (patrón fluent que usa IncidentesService) ───
  const buildQueryBuilder = (result: [Partial<Incidente>[], number]) => ({
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  });

  const mockRepo = {
    createQueryBuilder: jest.fn(() => buildQueryBuilder([incidentesMock, incidentesMock.length])),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [IncidentesController],
      providers: [
        IncidentesService,
        {
          provide: getRepositoryToken(Incidente),
          useValue: mockRepo,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
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
    // Restablecer el mock para cada test
    mockRepo.createQueryBuilder.mockImplementation(() =>
      buildQueryBuilder([incidentesMock, incidentesMock.length]),
    );
  });

  // ─────────────────────────────────────────────
  // CASO 1: Paginación por defecto → 200 con meta
  // ─────────────────────────────────────────────
  it('debería devolver 200 con lista paginada de incidentes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/incidentes');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toMatchObject({
      total_registros: 2,
      pagina_actual: 1,
      total_paginas: 1,
      registros_por_pagina: 10,
    });
  });

  // ─────────────────────────────────────────────
  // CASO 2: Filtro por estado válido → 200
  // ─────────────────────────────────────────────
  it('debería devolver 200 al filtrar por estado ABIERTO', async () => {
    const filtrado: Partial<Incidente>[] = [incidentesMock[0]];
    mockRepo.createQueryBuilder.mockImplementation(() =>
      buildQueryBuilder([filtrado, filtrado.length]),
    );

    const response = await request(app.getHttpServer()).get(
      '/api/v1/incidentes?estado=ABIERTO',
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total_registros).toBe(1);
  });

  // ─────────────────────────────────────────────
  // CASO 3: Filtro por sistema_id → 200
  // ─────────────────────────────────────────────
  it('debería devolver 200 al filtrar por sistema_id P04', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/incidentes?sistema_id=P04',
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.meta).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // CASO 4: Estado inválido → 400
  // ─────────────────────────────────────────────
  it('debería devolver 400 si el estado no es un valor del enum', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/incidentes?estado=INVENTADO',
    );

    expect(response.status).toBe(400);
  });

  // ─────────────────────────────────────────────
  // CASO 5: page=0 inválido → 400
  // ─────────────────────────────────────────────
  it('debería devolver 400 si page es menor a 1', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/incidentes?page=0',
    );

    expect(response.status).toBe(400);
  });
});
