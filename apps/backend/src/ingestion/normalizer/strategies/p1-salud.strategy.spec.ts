import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { normalizeP1Salud } from './p1-salud.strategy';

describe('normalizeP1Salud', () => {
  const basePayload = {
    eventId: 'evt_salud_0001',
    source: 'salud-domiciliaria',
    eventType: 'visit_not_registered',
    occurredAt: '2026-06-30T14:35:00Z',
    severity: 'high',
    status: 'pending',
    patientId: 'pac_anon_12345',
    visitId: 'vis_789',
    professionalId: 'prof_456',
    zone: 'Santiago Centro',
    description: 'La visita domiciliaria no fue registrada dentro del plazo esperado.',
    metadata: {
      scheduledAt: '2026-06-30T13:00:00Z',
      expectedCheckInUntil: '2026-06-30T13:30:00Z',
      lastKnownVisitState: 'assigned',
      careType: 'enfermeria',
      requiresFollowUp: true,
    },
  };

  const dto = (payload: Record<string, unknown>): CreateAlertaDto => ({
    sistema_id: 'P1',
    creado_en: '2026-06-30T14:35:00Z',
    payload,
  });

  it('normaliza prioridad y estado desde severity/status', () => {
    const result = normalizeP1Salud(dto(basePayload));

    expect(result.prioridad).toBe('ALTA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
    expect(result.externalId).toBe('evt_salud_0001');
  });

  it('construye titulo y descripcion con trazabilidad de negocio', () => {
    const result = normalizeP1Salud(dto(basePayload));

    expect(result.titulo).toContain('[P1 Salud]');
    expect(result.titulo).toContain('Visita no registrada');

    expect(result.descripcion).toContain('ID externo Salud: evt_salud_0001');
    expect(result.descripcion).toContain('Paciente anonimo: pac_anon_12345');
    expect(result.descripcion).toContain('Visita: vis_789');
    expect(result.descripcion).toContain('Tipo de atencion: enfermeria');
    expect(result.descripcion).toContain('Requiere seguimiento: Si');
  });

  it('usa reglas fallback cuando severity/status no vienen en payload', () => {
    const result = normalizeP1Salud(
      dto({
        eventId: 'evt_salud_0002',
        source: 'salud-domiciliaria',
        eventType: 'follow_up_required',
        occurredAt: '2026-06-30T15:00:00Z',
        patientId: 'pac_anon_0002',
      }),
    );

    expect(result.prioridad).toBe('MEDIA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.EN_PROGRESO);
  });
});
