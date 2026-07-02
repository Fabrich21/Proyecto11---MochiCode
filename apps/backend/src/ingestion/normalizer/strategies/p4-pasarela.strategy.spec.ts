import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { normalizeP4Pasarela } from './p4-pasarela.strategy';

describe('normalizeP4Pasarela', () => {
  const dto = (payload: Record<string, unknown>): CreateAlertaDto => ({
    sistema_id: 'P04',
    creado_en: '2026-06-28T00:30:00Z',
    payload,
  });

  it('normaliza NOT_EQUAL como CRITICA y EN_PROGRESO', () => {
    const result = normalizeP4Pasarela(
      dto({
        tipo: 'Transaccion',
        error: 'NOT_EQUAL',
        id_transaccion: '886ead0d-60fc-4156-89d9-ee7de4eef637',
        monto_original: 10000,
        monto_cobrado: 20000,
      }),
    );

    expect(result.prioridad).toBe('CRITICA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.EN_PROGRESO);
    expect(result.externalId).toBe('886ead0d-60fc-4156-89d9-ee7de4eef637');
    expect(result.titulo).toContain('Discrepancia de monto');
  });

  it('normaliza RETRY_WARNING como ALTA y ABIERTO', () => {
    const result = normalizeP4Pasarela(
      dto({
        tipo: 'Transaccion',
        error: 'RETRY_WARNING',
        ultimos_4: 4243,
        cantidad: 4,
        transacciones: ['id-1', 'id-2', 'id-3', 'id-4'],
      }),
    );

    expect(result.prioridad).toBe('ALTA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
    expect(result.descripcion).toContain('Cantidad intentos: 4');
  });

  it('normaliza conciliacion DIFERENCIA_DE_MONTO como CRITICA', () => {
    const result = normalizeP4Pasarela(
      dto({
        tipo: 'Conciliacion',
        tipo_discrepancia: 'DIFERENCIA_DE_MONTO',
        id_transaccion: '886ead0d-60fc-4156-89d9-ee7de4eef637',
        rrn: 512461,
        id_archivo: '45c5732b-2a95-417b-9041-4d62284aa3d6',
      }),
    );

    expect(result.prioridad).toBe('CRITICA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.EN_PROGRESO);
    expect(result.externalId).toBe('886ead0d-60fc-4156-89d9-ee7de4eef637');
  });

  it('usa id_archivo como externalId cuando id_transaccion es null', () => {
    const result = normalizeP4Pasarela(
      dto({
        tipo: 'Conciliacion',
        tipo_discrepancia: 'EXISTE_EN_BANCO',
        id_transaccion: null,
        rrn: 512461,
        id_archivo: '45c5732b-2a95-417b-9041-4d62284aa3d6',
      }),
    );

    expect(result.externalId).toBe('45c5732b-2a95-417b-9041-4d62284aa3d6');
    expect(result.prioridad).toBe('MEDIA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
  });
});
