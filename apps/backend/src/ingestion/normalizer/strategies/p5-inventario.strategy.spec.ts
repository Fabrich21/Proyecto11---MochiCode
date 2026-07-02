import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { normalizeP5Inventario } from './p5-inventario.strategy';

describe('normalizeP5Inventario', () => {
  const dto = (payload: Record<string, unknown>): CreateAlertaDto => ({
    sistema_id: 'P5',
    creado_en: '2026-06-30T22:33:00.000Z',
    payload,
  });

  it('normaliza critical_threshold_reached como CRITICA y EN_PROGRESO', () => {
    const result = normalizeP5Inventario(
      dto({
        source: 'inventory',
        event_type: 'critical_threshold_reached',
        project_id: 'proyecto-09',
        created_at: '2026-06-30T22:33:00.000Z',
        payload: {
          sku_id: 'PROD-001',
          location_id: 'b1b0b555-d41d-4e9e-88ef-222a7f5a4400',
          current_stock: 3,
          threshold_limite: 5,
          alert_id: 'a999b888-c777-d666-e555-f44444433333',
          product_name: 'Tornillo M8',
          location_name: 'Tienda Norte',
          city: 'Santiago',
        },
      }),
    );

    expect(result.prioridad).toBe('CRITICA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.EN_PROGRESO);
    expect(result.externalId).toBe('a999b888-c777-d666-e555-f44444433333');
    expect(result.titulo).toContain('[P5 Inventario]');
    expect(result.titulo).toContain('Umbral critico de stock alcanzado');
    expect(result.descripcion).toContain('Stock actual: 3');
    expect(result.descripcion).toContain('Umbral limite: 5');
  });

  it('normaliza stock_released con EXPIRED como ALTA y ABIERTO', () => {
    const result = normalizeP5Inventario(
      dto({
        source: 'inventory',
        event_type: 'stock_released',
        project_id: 'proyecto-09',
        created_at: '2026-06-30T22:32:00.000Z',
        payload: {
          sku_id: 'PROD-001',
          location_id: 'b1b0b555-d41d-4e9e-88ef-222a7f5a4400',
          quantity: 2,
          reservation_id: 42,
          reason: 'EXPIRED',
        },
      }),
    );

    expect(result.prioridad).toBe('ALTA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
    expect(result.externalId).toBe('42');
    expect(result.descripcion).toContain('Motivo liberacion: EXPIRED');
  });

  it('normaliza stock_released con RELEASED como CERRADO', () => {
    const result = normalizeP5Inventario(
      dto({
        source: 'inventory',
        event_type: 'stock_released',
        project_id: 'proyecto-09',
        created_at: '2026-06-30T22:32:00.000Z',
        payload: {
          sku_id: 'PROD-001',
          location_id: 'b1b0b555-d41d-4e9e-88ef-222a7f5a4400',
          quantity: 2,
          reservation_id: 42,
          reason: 'RELEASED',
        },
      }),
    );

    expect(result.estadoSugerido).toBe(IncidenteEstado.CERRADO);
    expect(result.prioridad).toBe('MEDIA');
  });

  it('usa fallback MEDIA y ABIERTO si llega un tipo no mapeado', () => {
    const result = normalizeP5Inventario(
      dto({
        source: 'inventory',
        event_type: 'unknown_event',
        project_id: 'proyecto-09',
        created_at: '2026-06-30T22:40:00.000Z',
        payload: {
          sku_id: 'PROD-001',
        },
      }),
    );

    expect(result.prioridad).toBe('MEDIA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
    expect(result.externalId).toBeUndefined();
  });
});
