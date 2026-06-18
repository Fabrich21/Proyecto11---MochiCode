export enum IncidenteEstado {
  ABIERTO = 'ABIERTO',
  EN_PROGRESO = 'EN_PROGRESO',
  CERRADO = 'CERRADO',
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
  fechaLimiteResolucion?: Date;
}

export interface IUpdateEstadoIncidenteDto {
  estado: IncidenteEstado;
  usuarioId: string;
}

export interface IGetIncidentesDto {
  page?: number;
  limit?: number;
  estado?: IncidenteEstado;
  sistema_id?: string;
  orden?: 'ASC' | 'DESC';
}
