import { IncidenteEstado } from '@proyecto/shared-types';

/**
 * Resultado estandarizado que produce cada estrategia de normalización.
 * Es el "idioma interno" del Worker, independiente del sistema emisor.
 */
export interface NormalizedAlerta {
  /** Título legible para el ticket (generado o extraído del payload externo). */
  titulo: string;

  /** Descripción semántica del incidente. */
  descripcion: string;

  /** Prioridad del incidente — usada para seleccionar la política SLA correcta. */
  prioridad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';

  /**
   * Estado inicial sugerido por el sistema emisor.
   * El Worker puede ignorarlo y arrancar siempre en ABIERTO si lo prefiere.
   */
  estadoSugerido: IncidenteEstado;

  /**
   * ID externo del incidente en el sistema origen (ej: "INC-1001" de P9).
   * Se almacena en la descripción para trazabilidad.
   */
  externalId?: string;
}
