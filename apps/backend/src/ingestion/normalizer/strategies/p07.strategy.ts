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
  
  // 1. Priorizamos el estándar universal (titulo). Fallback al viejo (asunto).
  const titulo = ticket?.titulo || ticket?.asunto || `[CRM] Alerta automática`;
  
  // 2. Priorizamos el estándar universal (prioridad).
  const prioridadRaw = String(ticket?.prioridad || '').toUpperCase();
  let prioridad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' = 'MEDIA';
  
  if (['CRITICA', 'ALTA', 'MEDIA', 'BAJA'].includes(prioridadRaw)) {
    prioridad = prioridadRaw as 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  }
  
  // 3. Mapeo especial de estados del P07
  const estadoRaw = String(ticket?.estado || '').toUpperCase();
  let estadoSugerido = IncidenteEstado.ABIERTO;
  
  if (estadoRaw === 'CERRADO' || estadoRaw === 'RESUELTO') {
    estadoSugerido = IncidenteEstado.CERRADO;
  } else if (estadoRaw === 'EN_PROGRESO') {
    estadoSugerido = IncidenteEstado.EN_PROGRESO;
  }

  // 4. Priorizamos el estándar universal (descripcion). 
  // Si no viene, armamos una a partir de sus metadatos internos o pegamos el JSON.
  let descripcion = ticket?.descripcion;
  if (!descripcion) {
    const ticketId = ticket?.id_ticket_interno || ticket?.id || 'N/A';
    const asignadoA = ticket?.agente_asignado || ticket?.agente_id || 'Sin agente';
    descripcion = `Ticket CRM #${ticketId} - Asignado a: ${asignadoA}\nPayload original: ${JSON.stringify(ticket)}`;
  } else {
    // Si viene descripcion, agregamos sus metadatos especiales al final para no perderlos
    const ticketId = ticket?.id_ticket_interno || ticket?.id || 'N/A';
    const asignadoA = ticket?.agente_asignado || ticket?.agente_id || 'Sin agente';
    descripcion = `${descripcion}\n\n---\n(ID Interno: ${ticketId} | Agente: ${asignadoA})`;
  }

  return {
    titulo,
    descripcion,
    prioridad,
    estadoSugerido,
  };
}
