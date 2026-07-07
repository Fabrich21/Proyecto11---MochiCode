
export enum IncidenteEstado {
  ABIERTO = 'ABIERTO',
  ASIGNADO = 'ASIGNADO',
  EN_PROGRESO = 'EN_PROGRESO',
  EN_INVESTIGACION = 'EN_INVESTIGACION',
  EN_RESOLUCION = 'EN_RESOLUCION',
  RESUELTO = 'RESUELTO',
  CERRADO = 'CERRADO',
  REABIERTO = 'REABIERTO',
}

export type IncidentSeverity = 'critical' | 'high' | 'medium';
export type IncidentStatus = IncidenteEstado;

export interface Responsible {
  id: string;
  name?: string;
  role?: string;
  assignedAt?: string | Date | null;
}

export interface ReassignmentLog {
  id?: string;
  fromStatus?: IncidentStatus | string;
  toStatus?: IncidentStatus | string;
  reason?: string | null;
  at: string | Date;
  note?: string | null;
}

export interface IncidentEventEntry {
  id?: string;
  type: 'created' | 'updated' | 'resolved' | 'closed' | 'assigned' | 'reopened' | 'commented' | 'attachment';
  title: string;
  description?: string | null;
  at: string | Date;
  author?: string | null;
}

const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  [IncidenteEstado.ABIERTO]: 'Abierto',
  [IncidenteEstado.ASIGNADO]: 'Asignado',
  [IncidenteEstado.EN_PROGRESO]: 'En progreso',
  [IncidenteEstado.EN_INVESTIGACION]: 'En investigación',
  [IncidenteEstado.EN_RESOLUCION]: 'En resolución',
  [IncidenteEstado.RESUELTO]: 'Resuelto',
  [IncidenteEstado.CERRADO]: 'Cerrado',
  [IncidenteEstado.REABIERTO]: 'Reabierto',
};

const INCIDENT_STATUS_CLASSES: Record<IncidentStatus, string> = {
  [IncidenteEstado.ABIERTO]: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  [IncidenteEstado.ASIGNADO]: 'bg-sky-100 text-sky-700 border-sky-300',
  [IncidenteEstado.EN_PROGRESO]: 'bg-blue-100 text-blue-700 border-blue-300',
  [IncidenteEstado.EN_INVESTIGACION]: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  [IncidenteEstado.EN_RESOLUCION]: 'bg-orange-100 text-orange-700 border-orange-300',
  [IncidenteEstado.RESUELTO]: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  [IncidenteEstado.CERRADO]: 'bg-gray-100 text-gray-600 border-gray-300',
  [IncidenteEstado.REABIERTO]: 'bg-rose-100 text-rose-700 border-rose-300',
};

export function normalizeIncidentStatus(status?: string | IncidentStatus | null): IncidentStatus {
  const normalized = String(status ?? IncidenteEstado.ABIERTO).toUpperCase();

  switch (normalized) {
    case IncidenteEstado.ASIGNADO:
      return IncidenteEstado.ASIGNADO;
    case IncidenteEstado.EN_PROGRESO:
      return IncidenteEstado.EN_PROGRESO;
    case IncidenteEstado.EN_INVESTIGACION:
      return IncidenteEstado.EN_INVESTIGACION;
    case IncidenteEstado.EN_RESOLUCION:
      return IncidenteEstado.EN_RESOLUCION;
    case IncidenteEstado.RESUELTO:
      return IncidenteEstado.RESUELTO;
    case IncidenteEstado.CERRADO:
      return IncidenteEstado.CERRADO;
    case IncidenteEstado.REABIERTO:
      return IncidenteEstado.REABIERTO;
    default:
      return IncidenteEstado.ABIERTO;
  }
}

export function getIncidentStatusLabel(status?: string | IncidentStatus | null): string {
  const normalized = normalizeIncidentStatus(status);
  return INCIDENT_STATUS_LABELS[normalized] ?? String(status ?? 'No reportado');
}

export function getIncidentStatusBadgeClassName(status?: string | IncidentStatus | null): string {
  const normalized = normalizeIncidentStatus(status);
  return INCIDENT_STATUS_CLASSES[normalized] ?? INCIDENT_STATUS_CLASSES[IncidenteEstado.ABIERTO];
}

export interface Incident {
  id: string;
  externalId?: string;  
  externalSource?: string;        
  title?: string;
  severity: IncidentSeverity;
  system: string;
  description: string;
  resolutionSummary?: string | null;
  slaRemaining: number;
  slaPercentage: number;
  createdAt: Date | string;
  affectedUsers?: number;
  affectedProject?: string;
  incidentStatus?: IncidentStatus | string;
  acknowledgedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  closedAt?: Date | string | null;
  slaTargetMinutes?: number | null;
  assignedTo?: Responsible[];
  reassignmentHistory?: ReassignmentLog[];
  alertPayload?: Record<string, unknown> | string | null;
  events?: IncidentEventEntry[];
  eventType?: 'created' | 'resolved' | 'updated';
}

export interface IncidentUpdate {
  incidentStatus?: IncidentStatus | string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
}