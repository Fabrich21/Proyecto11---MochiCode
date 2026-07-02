import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { normalizeP07 } from './p07.strategy';

describe('normalizeP07', () => {
  const dto = (sistemaId: string, payload: Record<string, unknown>): CreateAlertaDto => ({
    sistema_id: sistemaId,
    creado_en: '2026-07-02T00:00:00.000Z',
    payload,
  });

  it('mapea prioridad y estado estandarizados de CRM', () => {
    const result = normalizeP07(
      dto('P07', {
        titulo: 'Cliente con incidente de facturacion',
        descripcion: 'Error en ciclo de cobro',
        prioridad: 'critica',
        estado: 'en_progreso',
        id_ticket_interno: 'crm-123',
      }),
    );

    expect(result.titulo).toBe('Cliente con incidente de facturacion');
    expect(result.prioridad).toBe('CRITICA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.EN_PROGRESO);
    expect(result.descripcion).toContain('ID Interno: crm-123');
  });

  it('usa fallback cuando faltan campos principales', () => {
    const result = normalizeP07(
      dto('P7', {
        asunto: 'Asunto legado CRM',
        agente_asignado: 'agente-77',
      }),
    );

    expect(result.titulo).toBe('Asunto legado CRM');
    expect(result.prioridad).toBe('MEDIA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
    expect(result.descripcion).toContain('agente-77');
  });
});
