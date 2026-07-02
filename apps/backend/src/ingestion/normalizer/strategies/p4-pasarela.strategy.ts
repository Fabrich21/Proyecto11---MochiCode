import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { NormalizedAlerta } from '../../dto/normalized-alerta.dto';

type PasarelaTipo = 'Transaccion' | 'Conciliacion';
type PasarelaError = 'NOT_EQUAL' | 'RETRY_WARNING';
type TipoDiscrepancia =
  | 'EXISTE_EN_BANCO'
  | 'FALTANTE_EN_BANCO'
  | 'DIFERENCIA_DE_MONTO';

interface P4Payload {
  tipo?: PasarelaTipo;
  error?: PasarelaError;
  id_transaccion?: string | null;
  monto_original?: number;
  monto_cobrado?: number;
  ultimos_4?: number;
  cantidad?: number;
  transacciones?: string[];
  tipo_discrepancia?: TipoDiscrepancia;
  rrn?: number;
  id_archivo?: string;
}

export function normalizeP4Pasarela(dto: CreateAlertaDto): NormalizedAlerta {
  const payload = dto.payload as P4Payload;

  return {
    titulo: buildTitulo(payload),
    descripcion: buildDescripcion(payload),
    prioridad: inferPriority(payload),
    estadoSugerido: inferState(payload),
    externalId: inferExternalId(payload),
  };
}

function inferPriority(payload: P4Payload): NormalizedAlerta['prioridad'] {
  if (payload.tipo === 'Transaccion' && payload.error === 'NOT_EQUAL') {
    return 'CRITICA';
  }

  if (payload.tipo === 'Transaccion' && payload.error === 'RETRY_WARNING') {
    return 'ALTA';
  }

  if (payload.tipo === 'Conciliacion') {
    if (payload.tipo_discrepancia === 'DIFERENCIA_DE_MONTO') return 'CRITICA';
    if (payload.tipo_discrepancia === 'FALTANTE_EN_BANCO') return 'ALTA';
    if (payload.tipo_discrepancia === 'EXISTE_EN_BANCO') return 'MEDIA';
  }

  return 'MEDIA';
}

function inferState(payload: P4Payload): IncidenteEstado {
  if (payload.tipo === 'Transaccion' && payload.error === 'RETRY_WARNING') {
    return IncidenteEstado.ABIERTO;
  }

  if (payload.tipo === 'Conciliacion' && payload.tipo_discrepancia === 'EXISTE_EN_BANCO') {
    return IncidenteEstado.ABIERTO;
  }

  return IncidenteEstado.EN_PROGRESO;
}

function inferExternalId(payload: P4Payload): string | undefined {
  if (payload.id_transaccion) return payload.id_transaccion;
  if (payload.id_archivo) return payload.id_archivo;
  return undefined;
}

function buildTitulo(payload: P4Payload): string {
  if (payload.tipo === 'Transaccion' && payload.error === 'NOT_EQUAL') {
    return '[P4 Pasarela] Discrepancia de monto en transaccion';
  }

  if (payload.tipo === 'Transaccion' && payload.error === 'RETRY_WARNING') {
    return '[P4 Pasarela] Reintentos sospechosos de tarjeta';
  }

  if (payload.tipo === 'Conciliacion') {
    return '[P4 Pasarela] Discrepancia de conciliacion bancaria';
  }

  return '[P4 Pasarela] Alerta operacional';
}

function buildDescripcion(payload: P4Payload): string {
  const lines: string[] = [];

  if (payload.tipo) lines.push(`Tipo alerta: ${payload.tipo}`);
  if (payload.error) lines.push(`Codigo error: ${payload.error}`);
  if (payload.id_transaccion != null)
    lines.push(`Id transaccion: ${payload.id_transaccion}`);

  if (payload.monto_original != null)
    lines.push(`Monto original: ${payload.monto_original}`);
  if (payload.monto_cobrado != null)
    lines.push(`Monto cobrado: ${payload.monto_cobrado}`);

  if (payload.ultimos_4 != null) lines.push(`Ultimos 4 tarjeta: ${payload.ultimos_4}`);
  if (payload.cantidad != null) lines.push(`Cantidad intentos: ${payload.cantidad}`);
  if (payload.transacciones?.length)
    lines.push(`Transacciones relacionadas: ${payload.transacciones.join(', ')}`);

  if (payload.tipo_discrepancia)
    lines.push(`Tipo discrepancia: ${payload.tipo_discrepancia}`);
  if (payload.rrn != null) lines.push(`RRN: ${payload.rrn}`);
  if (payload.id_archivo) lines.push(`Archivo conciliacion: ${payload.id_archivo}`);

  return lines.join(' | ');
}
