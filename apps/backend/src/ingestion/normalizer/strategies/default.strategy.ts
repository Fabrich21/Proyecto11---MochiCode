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
  return {
    titulo: `[${dto.sistema_id}] Alerta automática — ${new Date().toISOString()}`,
    descripcion: `Payload recibido de ${dto.sistema_id}: ${JSON.stringify(dto.payload)}`,
    prioridad: 'MEDIA',
    estadoSugerido: IncidenteEstado.ABIERTO,
  };
}
