import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { P6NotificacionesService } from './p6-notificaciones.service';

describe('P6NotificacionesService', () => {
  let service: P6NotificacionesService;

  const mockHttpService = {
    post: jest.fn().mockReturnValue(of({ data: { ok: true } })),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        P6_NOTIFICACIONES_URL: 'https://p6.test/notifications/send',
        API_KEY_PROYECTO_11: 'test-api-key',
      };
      return values[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        P6NotificacionesService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(P6NotificacionesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería enviar email de asignación con el contrato P6', async () => {
    await service.enviarEmailAsignacionTicket({
      email: 'operador@test.com',
      incidenteId: 'inc-1',
      titulo: 'Caída de pagos',
      asignadoAUsuarioId: 'user-uuid',
    });

    expect(mockHttpService.post).toHaveBeenCalledWith(
      'https://p6.test/notifications/send',
      expect.objectContaining({
        channel: 'email',
        recipient: { email: 'operador@test.com' },
        subject: expect.stringContaining('Caída de pagos'),
        body: { email: expect.stringContaining('inc-1') },
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          API_KEY_PROYECTO_11: 'test-api-key',
        }),
      }),
    );
  });

  it('debería enviar SMS móvil al vencer un SLA', async () => {
    await service.enviarNotificacionMovilSlaVencido({
      telefono: '+56912345678',
      incidenteId: 'inc-2',
      titulo: 'Alerta crítica',
      usuarioDestinoId: 'guardia-uuid',
    });

    expect(mockHttpService.post).toHaveBeenCalledWith(
      'https://p6.test/notifications/send',
      expect.objectContaining({
        channel: 'sms',
        recipient: { telefono: '+56912345678' },
        body: { sms: expect.stringContaining('SLA VENCIDO') },
      }),
      expect.any(Object),
    );
  });
});
