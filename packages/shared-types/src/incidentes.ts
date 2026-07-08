export enum IncidenteEstado {
  ABIERTO = 'ABIERTO',
  EN_PROGRESO = 'EN_PROGRESO',
  CERRADO = 'CERRADO',
  VENCIDO = 'VENCIDO',
}

export interface IIncidente {
  id: string;
  titulo: string;
  descripcion?: string;
  estado: IncidenteEstado;
  sistemaId: string;
  creadorUsuarioId: string;
  politicaSlaId: string;
  creadoEn: Date;
  asignadoAUsuarioId?: string;
  prioridad: string;
  fechaResolucion?: Date;
  slaVencido: boolean;
  fechaLimiteResolucion?: Date;
  crmTicketId?: string;
}

export interface IUpdateEstadoIncidenteDto {
  estado: IncidenteEstado;
  usuarioId?: string;
}

export interface IAsignarIncidenteDto {
  asignadoAUsuarioId: string;
  usuarioId?: string;
  email?: string;
}

export interface IGetIncidentesDto {
  page?: number;
  limit?: number;
  estado?: IncidenteEstado;
  sistema_id?: string;
  orden?: 'ASC' | 'DESC';
  prioridad?: string;
  asignado_a?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  q?: string;
}

export type P9Severity = 'critical' | 'high' | 'medium' | 'low';
export type P9Status = 'open' | 'investigating' | 'resolved';
export type P9EventType = 'incident_created' | 'incident_status_changed' | 'incident_resolved';

export interface IP9Payload {
  incident_id: string;
  title?: string;
  severity: P9Severity;
  status: P9Status;
  opened_at?: string;
  resolved_at?: string;
  resolution_time_hours?: number;
  sla_met?: boolean;
}

export interface IP9Envelope {
  source: 'incidents';
  event_type: P9EventType;
  payload: IP9Payload;
}
