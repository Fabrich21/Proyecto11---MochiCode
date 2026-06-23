import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { NormalizedAlerta } from '../../dto/normalized-alerta.dto';

/**
 * Normalizador para Proyecto 7 (CRM).
 * 
 * Extrae el asunto y la prioridad del TicketDto enviado.
 */
export function normalizeP07(dto: CreateAlertaDto): NormalizedAlerta {
  const ticket = dto.payload;
  
  // Extraemos título del asunto si viene
  const titulo = ticket?.asunto || `[CRM] Alerta automática`;
  
  // Extraemos prioridad y mapeamos (asumimos que puede venir 'critica', 'alta', etc.)
  const prioridadRaw = String(ticket?.prioridad || '').toUpperCase();
  let prioridad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' = 'MEDIA';
  
  if (['CRITICA', 'ALTA', 'MEDIA', 'BAJA'].includes(prioridadRaw)) {
    prioridad = prioridadRaw as 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  }
  
  // Mapear el estado (opcional)
  const estadoRaw = String(ticket?.estado || '').toUpperCase();
  let estadoSugerido = IncidenteEstado.ABIERTO;
  
  if (estadoRaw === 'CERRADO' || estadoRaw === 'RESUELTO') {
    estadoSugerido = IncidenteEstado.CERRADO;
  } else if (estadoRaw === 'EN_PROGRESO') {
    estadoSugerido = IncidenteEstado.EN_PROGRESO;
  }

  return {
    titulo,
    descripcion: `Ticket CRM #${ticket?.id || 'N/A'} - Asignado a: ${ticket?.agente_id || 'Sin agente'}\nPayload original: ${JSON.stringify(dto.payload)}`,
    prioridad,
    estadoSugerido,
  };
}
