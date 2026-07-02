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
}

export interface IUpdateEstadoIncidenteDto {
  estado: IncidenteEstado;
  usuarioId: string;
}

export interface IAsignarIncidenteDto {
  asignadoAUsuarioId: string;
  usuarioId: string;
  email?: string;
}

export interface IGetIncidentesDto {
  page?: number;
  limit?: number;
  estado?: IncidenteEstado;
  sistema_id?: string;
  orden?: 'ASC' | 'DESC';
}

export interface IP9EventoOperacionalCierre {
  evento: 'Cierre';
  incidente_id: string;
  sistema_id: string;
  estado_final: IncidenteEstado;
  creado_en: string;
  fecha_resolucion: string;
  mttr_minutos: number;
  sla_vencido: boolean;
  prioridad: string;
}
