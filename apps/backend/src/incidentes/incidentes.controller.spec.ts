import { Test, TestingModule } from '@nestjs/testing';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';
import { IncidenteEstado } from '@proyecto/shared-types';

describe('IncidentesController', () => {
  let controller: IncidentesController;
  let service: IncidentesService;

  // Creamos un mock del servicio para no tocar la base de datos real
  const mockIncidentesService = {
    findAll: jest.fn(),
    cambiarEstado: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentesController],
      providers: [
        {
          provide: IncidentesService,
          useValue: mockIncidentesService,
        },
      ],
    }).compile();

    controller = module.get<IncidentesController>(IncidentesController);
    service = module.get<IncidentesService>(IncidentesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('debería llamar al servicio con los parámetros de consulta', async () => {
      // Preparar (Arrange)
      const mockResult = {
        data: [],
        meta: { total_registros: 0, pagina_actual: 1, total_paginas: 0, registros_por_pagina: 10 },
      };
      mockIncidentesService.findAll.mockResolvedValue(mockResult);

      // Actuar (Act)
      const query = { page: 1, limit: 10 };
      const result = await controller.findAll(query);

      // Afirmar (Assert)
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('cambiarEstado', () => {
    it('debería llamar al servicio para actualizar el estado', async () => {
      // Preparar
      const mockResult = { id: 'uuid-123', estado: IncidenteEstado.CERRADO };
      mockIncidentesService.cambiarEstado.mockResolvedValue(mockResult);
      const updateDto = { estado: IncidenteEstado.CERRADO, usuarioId: 'user-123' };

      // Actuar
      const result = await controller.cambiarEstado('uuid-123', updateDto, { user: { sub: 'mock-user' } });

      // Afirmar
      expect(service.cambiarEstado).toHaveBeenCalledWith('uuid-123', updateDto);
      expect(result).toEqual(mockResult);
    });
  });
});
