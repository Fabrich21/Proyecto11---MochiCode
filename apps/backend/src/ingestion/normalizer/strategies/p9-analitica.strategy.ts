import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { NormalizedAlerta } from '../../dto/normalized-alerta.dto';

// ---------------------------------------------------------------------------
// Tipos del payload externo de P9 (Grupo Analítica)
// Formato documentado en: POST http://localhost:8000/events
// ---------------------------------------------------------------------------
type P9Severity = 'critical' | 'high' | 'medium' | 'low';
type P9Status = 'open' | 'investigating' | 'resolved';
type P9EventType =
  | 'incident_created'
  | 'incident_upsert'
  | 'incident_assigned'
  | 'incident_status_changed'
  | 'incident_resolved';

interface P9InnerPayload {
  incident_id: string;
  title?: string;
  severity?: P9Severity;
  status?: P9Status;
  assignee?: string | null;
  opened_at?: string;
  resolved_at?: string;
  resolution_time_hours?: number;
  sla_met?: boolean;
}

interface P9Payload {
  source: string;
  event_type: P9EventType;
  payload: P9InnerPayload;
}

// ---------------------------------------------------------------------------
// Mapas de traducción P9 → esquema interno
// ---------------------------------------------------------------------------
const SEVERITY_MAP: Record<P9Severity, NormalizedAlerta['prioridad']> = {
  critical: 'CRITICA',
  high: 'ALTA',
  medium: 'MEDIA',
  low: 'BAJA',
};

const STATUS_MAP: Record<P9Status, IncidenteEstado> = {
  open: IncidenteEstado.ABIERTO,
  investigating: IncidenteEstado.EN_PROGRESO,
  resolved: IncidenteEstado.CERRADO,
};

// ---------------------------------------------------------------------------
// Estrategia principal
// ---------------------------------------------------------------------------
/**
 * Normaliza el payload del Grupo 9 (Analítica) al esquema interno.
 *
 * P9 envía eventos de ciclo de vida de incidentes con 4 tipos:
 *  - incident_created / incident_upsert: nuevo incidente
 *  - incident_assigned:                  cambio de responsable
 *  - incident_status_changed:            cambio de estado/severidad
 *  - incident_resolved:                  cierre del incidente
 */
export function normalizeP9Analitica(dto: CreateAlertaDto): NormalizedAlerta {
  const outer = dto.payload as P9Payload;
  const inner: P9InnerPayload = outer?.payload ?? {};

  const prioridad: NormalizedAlerta['prioridad'] =
    SEVERITY_MAP[inner.severity as P9Severity] ?? 'MEDIA';

  const estadoSugerido: IncidenteEstado =
    STATUS_MAP[inner.status as P9Status] ?? IncidenteEstado.ABIERTO;

  const externalId = inner.incident_id;
  const eventType: P9EventType = outer?.event_type;

  const titulo = buildTitulo(eventType, inner);
  const descripcion = buildDescripcion(eventType, inner, externalId);

  return { titulo, descripcion, prioridad, estadoSugerido, externalId };
}

// ---------------------------------------------------------------------------
// Helpers de construcción de texto semántico
// ---------------------------------------------------------------------------
function buildTitulo(eventType: P9EventType, inner: P9InnerPayload): string {
  const base = inner.title ?? `Incidente ${inner.incident_id}`;

  switch (eventType) {
    case 'incident_created':
    case 'incident_upsert':
      return `[P9] ${base}`;

    case 'incident_assigned':
      return `[P9] Asignación actualizada — ${base}`;

    case 'incident_status_changed':
      return `[P9] Cambio de estado — ${base}`;

    case 'incident_resolved':
      return `[P9] Resuelto — ${base}`;

    default:
      return `[P9] ${base}`;
  }
}

function buildDescripcion(
  eventType: P9EventType,
  inner: P9InnerPayload,
  externalId: string,
): string {
  const lines: string[] = [`ID externo P9: ${externalId}`];

  if (inner.severity) lines.push(`Severidad: ${inner.severity}`);
  if (inner.status)   lines.push(`Estado en origen: ${inner.status}`);
  if (inner.assignee) lines.push(`Responsable: ${inner.assignee}`);

  switch (eventType) {
    case 'incident_created':
    case 'incident_upsert':
      if (inner.opened_at) lines.push(`Abierto en origen: ${inner.opened_at}`);
      break;

    case 'incident_resolved':
      if (inner.resolved_at)
        lines.push(`Resuelto en origen: ${inner.resolved_at}`);
      if (inner.resolution_time_hours != null)
        lines.push(`Tiempo de resolución: ${inner.resolution_time_hours}h`);
      if (inner.sla_met != null)
        lines.push(`SLA cumplido en origen: ${inner.sla_met ? 'Sí' : 'No'}`);
      break;
  }

  return lines.join(' | ');
}
