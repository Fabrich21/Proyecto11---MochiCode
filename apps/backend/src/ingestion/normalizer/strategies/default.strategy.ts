import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { NormalizedAlerta } from '../../dto/normalized-alerta.dto';

/**
 * Estrategia por defecto para sistemas sin normalización específica.
 *
 * Genera un título genérico y asigna prioridad MEDIA.
 * Cubre: sistemas no identificados, payloads de formato libre, IoT básico.
 */
export function normalizeDefault(dto: CreateAlertaDto): NormalizedAlerta {
  const payload = dto.payload || {};
  
  // Si envían los campos estándar que pedimos, los usamos. Si no, usamos defaults.
  const titulo = payload.titulo || `[${dto.sistema_id}] Alerta automática — ${new Date().toISOString()}`;
  
  // Si no hay descripción, pegamos todo el JSON para que soporte pueda leer los campos internos
  const descripcion = payload.descripcion || `Payload recibido de ${dto.sistema_id}: ${JSON.stringify(payload)}`;
  
  // Extraemos la prioridad, asumiendo que envían 'critica', 'alta', 'media', o 'baja'
  const prioridadRaw = String(payload.prioridad || '').toUpperCase();
  let prioridad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' = 'MEDIA';
  
  if (['CRITICA', 'ALTA', 'MEDIA', 'BAJA'].includes(prioridadRaw)) {
    prioridad = prioridadRaw as 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  }

  return {
    titulo,
    descripcion,
    prioridad,
    estadoSugerido: IncidenteEstado.ABIERTO,
  };
}
