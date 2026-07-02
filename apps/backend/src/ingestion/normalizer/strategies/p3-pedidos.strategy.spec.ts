import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { normalizeP3Pedidos } from './p3-pedidos.strategy';

describe('normalizeP3Pedidos', () => {
  const dto = (payload: Record<string, unknown>): CreateAlertaDto => ({
    sistema_id: 'P3',
    creado_en: '2026-06-30T22:33:00.000Z',
    payload,
  });

  it('normaliza pedido_creado con payload extendido', () => {
    const result = normalizeP3Pedidos(
      dto({
        source: 'orders',
        event_type: 'pedido_creado',
        payload: {
          order_id: 10567,
          customer_id: 8831,
          sales_channel: 'web',
          total_amount: 45000,
          total_items: 3,
        },
      }),
    );

    expect(result.prioridad).toBe('BAJA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
    expect(result.externalId).toBe('10567');
    expect(result.titulo).toContain('[P3 Pedidos]');
    expect(result.titulo).toContain('Pedido creado');
    expect(result.descripcion).toContain('Canal: web');
  });

  it('normaliza pago_fallido como CRITICA y EN_PROGRESO', () => {
    const result = normalizeP3Pedidos(
      dto({
        source: 'orders',
        event_type: 'pago_fallido',
        payload: {
          order_id: 10567,
          customer_id: 8831,
        },
      }),
    );

    expect(result.prioridad).toBe('CRITICA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.EN_PROGRESO);
    expect(result.externalId).toBe('10567');
  });

  it('normaliza pedido_entregado como CERRADO', () => {
    const result = normalizeP3Pedidos(
      dto({
        source: 'orders',
        event_type: 'pedido_entregado',
        payload: {
          order_id: 10567,
          customer_id: 8831,
        },
      }),
    );

    expect(result.prioridad).toBe('BAJA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.CERRADO);
  });
});
