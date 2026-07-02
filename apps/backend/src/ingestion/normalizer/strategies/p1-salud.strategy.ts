import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { NormalizedAlerta } from '../../dto/normalized-alerta.dto';

type SaludSeverity = 'low' | 'medium' | 'high' | 'critical';
type SaludStatus = 'pending' | 'in_progress' | 'resolved' | 'cancelled';

interface SaludMetadata {
  scheduledAt?: string;
  expectedCheckInUntil?: string;
  lastKnownVisitState?: string;
  careType?: string;
  requiresFollowUp?: boolean;
}

interface SaludPayload {
  eventId: string;
  source: string;
  eventType: string;
  occurredAt: string;
  severity?: SaludSeverity;
  status?: SaludStatus;
  patientId: string;
  visitId?: string;
  professionalId?: string;
  zone?: string;
  description?: string;
  metadata?: SaludMetadata;
}

const SEVERITY_MAP: Record<SaludSeverity, NormalizedAlerta['prioridad']> = {
  critical: 'CRITICA',
  high: 'ALTA',
  medium: 'MEDIA',
  low: 'BAJA',
};

const STATUS_MAP: Record<SaludStatus, IncidenteEstado> = {
  pending: IncidenteEstado.ABIERTO,
  in_progress: IncidenteEstado.EN_PROGRESO,
  resolved: IncidenteEstado.CERRADO,
  cancelled: IncidenteEstado.CERRADO,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  visit_not_registered: 'Visita no registrada',
  visit_cancelled_late: 'Visita cancelada fuera de plazo',
  professional_no_show: 'Profesional sin check-in',
  patient_no_response: 'Paciente no responde',
  follow_up_required: 'Seguimiento requerido',
  offline_sync_failed: 'Falla de sincronizacion offline',
  care_record_incomplete: 'Registro de atencion incompleto',
};

export function normalizeP1Salud(dto: CreateAlertaDto): NormalizedAlerta {
  const payload = dto.payload as SaludPayload;

  const prioridad =
    SEVERITY_MAP[payload?.severity as SaludSeverity] ??
    inferPriorityByEventType(payload?.eventType);

  const estadoSugerido =
    STATUS_MAP[payload?.status as SaludStatus] ??
    inferStateByEventType(payload?.eventType);

  const externalId = payload?.eventId;
  const titulo = buildTitulo(payload);
  const descripcion = buildDescripcion(payload);

  return { titulo, descripcion, prioridad, estadoSugerido, externalId };
}

function inferPriorityByEventType(eventType?: string): NormalizedAlerta['prioridad'] {
  switch (eventType) {
    case 'offline_sync_failed':
    case 'visit_not_registered':
    case 'professional_no_show':
      return 'ALTA';
    case 'follow_up_required':
    case 'care_record_incomplete':
      return 'MEDIA';
    default:
      return 'MEDIA';
  }
}

function inferStateByEventType(eventType?: string): IncidenteEstado {
  if (eventType === 'follow_up_required') {
    return IncidenteEstado.EN_PROGRESO;
  }

  return IncidenteEstado.ABIERTO;
}

function buildTitulo(payload: SaludPayload): string {
  const eventTypeLabel = EVENT_TYPE_LABELS[payload?.eventType] ?? 'Evento operacional';
  const visitToken = payload?.visitId ? ` | Visita ${payload.visitId}` : '';

  return `[P1 Salud] ${eventTypeLabel}${visitToken}`;
}

function buildDescripcion(payload: SaludPayload): string {
  const lines: string[] = [];

  if (payload?.eventId) lines.push(`ID externo Salud: ${payload.eventId}`);
  if (payload?.source) lines.push(`Origen: ${payload.source}`);
  if (payload?.eventType) lines.push(`Tipo: ${payload.eventType}`);
  if (payload?.occurredAt) lines.push(`Ocurrido en: ${payload.occurredAt}`);
  if (payload?.patientId) lines.push(`Paciente anonimo: ${payload.patientId}`);
  if (payload?.visitId) lines.push(`Visita: ${payload.visitId}`);
  if (payload?.professionalId) lines.push(`Profesional: ${payload.professionalId}`);
  if (payload?.zone) lines.push(`Zona: ${payload.zone}`);
  if (payload?.description) lines.push(`Detalle: ${payload.description}`);

  if (payload?.metadata?.scheduledAt) {
    lines.push(`Programada para: ${payload.metadata.scheduledAt}`);
  }
  if (payload?.metadata?.expectedCheckInUntil) {
    lines.push(`Check-in esperado hasta: ${payload.metadata.expectedCheckInUntil}`);
  }
  if (payload?.metadata?.lastKnownVisitState) {
    lines.push(`Ultimo estado visita: ${payload.metadata.lastKnownVisitState}`);
  }
  if (payload?.metadata?.careType) {
    lines.push(`Tipo de atencion: ${payload.metadata.careType}`);
  }
  if (payload?.metadata?.requiresFollowUp != null) {
    lines.push(
      `Requiere seguimiento: ${payload.metadata.requiresFollowUp ? 'Si' : 'No'}`,
    );
  }

  return lines.join(' | ');
}
