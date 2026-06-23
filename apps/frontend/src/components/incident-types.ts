
export enum IncidenteEstado {
  ABIERTO = 'ABIERTO',
  EN_PROGRESO = 'EN_PROGRESO',
  CERRADO = 'CERRADO',
}

export type IncidentSeverity = 'critical' | 'high' | 'medium';
export type IncidentStatus = IncidenteEstado;

export interface Incident {
  id: string;
  severity: IncidentSeverity;
  system: string;
  description: string;
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
}

export interface IncidentUpdate {
  incidentStatus?: IncidentStatus | string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
}