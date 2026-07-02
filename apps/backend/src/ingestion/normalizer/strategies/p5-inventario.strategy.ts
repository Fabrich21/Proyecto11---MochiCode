import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { NormalizedAlerta } from '../../dto/normalized-alerta.dto';

type InventoryEventType =
  | 'stock_received'
  | 'stock_dispatched'
  | 'stock_adjusted'
  | 'stock_transfer_initiated'
  | 'stock_reserved'
  | 'stock_released'
  | 'critical_threshold_reached';

interface InventoryPayload {
  sku_id?: string;
  location_id?: string;
  quantity?: number;
  unit_price?: number;
  product_name?: string;
  category?: string;
  unit?: string;
  location_name?: string;
  location_type?: string;
  movement_id?: string;
  order_id?: string;
  reservation_id?: number;
  reason?: 'RELEASED' | 'EXPIRED';
  current_stock?: number;
  threshold_limite?: number;
  alert_id?: string;
  city?: string;
}

interface InventoryEnvelope {
  source?: string;
  event_type?: InventoryEventType;
  project_id?: string;
  created_at?: string;
  payload?: InventoryPayload;
}

const EVENT_TITLE_MAP: Record<InventoryEventType, string> = {
  stock_received: 'Ingreso de stock',
  stock_dispatched: 'Salida de stock',
  stock_adjusted: 'Ajuste de inventario',
  stock_transfer_initiated: 'Transferencia de stock iniciada',
  stock_reserved: 'Reserva de stock',
  stock_released: 'Liberacion de reserva de stock',
  critical_threshold_reached: 'Umbral critico de stock alcanzado',
};

export function normalizeP5Inventario(dto: CreateAlertaDto): NormalizedAlerta {
  const envelope = dto.payload as InventoryEnvelope;
  const eventType = envelope?.event_type;
  const payload = envelope?.payload ?? {};

  const prioridad = inferPriority(eventType, payload.reason);
  const estadoSugerido = inferState(eventType, payload.reason);
  const externalId = inferExternalId(payload);

  return {
    titulo: buildTitulo(eventType, payload),
    descripcion: buildDescripcion(envelope, payload),
    prioridad,
    estadoSugerido,
    externalId,
  };
}

function inferPriority(
  eventType?: InventoryEventType,
  reason?: InventoryPayload['reason'],
): NormalizedAlerta['prioridad'] {
  if (eventType === 'critical_threshold_reached') return 'CRITICA';
  if (eventType === 'stock_released' && reason === 'EXPIRED') return 'ALTA';
  if (eventType === 'stock_transfer_initiated') return 'MEDIA';
  if (eventType === 'stock_adjusted') return 'MEDIA';
  if (eventType === 'stock_reserved') return 'MEDIA';
  if (eventType === 'stock_dispatched') return 'BAJA';
  if (eventType === 'stock_received') return 'BAJA';
  return 'MEDIA';
}

function inferState(
  eventType?: InventoryEventType,
  reason?: InventoryPayload['reason'],
): IncidenteEstado {
  if (eventType === 'stock_released' && reason === 'RELEASED') {
    return IncidenteEstado.CERRADO;
  }

  if (eventType === 'critical_threshold_reached') {
    return IncidenteEstado.EN_PROGRESO;
  }

  return IncidenteEstado.ABIERTO;
}

function inferExternalId(payload: InventoryPayload): string | undefined {
  if (payload.alert_id) return payload.alert_id;
  if (payload.movement_id) return payload.movement_id;
  if (payload.reservation_id != null) return String(payload.reservation_id);
  return undefined;
}

function buildTitulo(
  eventType?: InventoryEventType,
  payload?: InventoryPayload,
): string {
  const base = eventType ? EVENT_TITLE_MAP[eventType] : 'Evento de inventario';
  const sku = payload?.sku_id ? ` | SKU ${payload.sku_id}` : '';
  return `[P5 Inventario] ${base}${sku}`;
}

function buildDescripcion(
  envelope: InventoryEnvelope,
  payload: InventoryPayload,
): string {
  const lines: string[] = [];

  if (envelope?.source) lines.push(`Origen: ${envelope.source}`);
  if (envelope?.event_type) lines.push(`Tipo: ${envelope.event_type}`);
  if (envelope?.project_id) lines.push(`Proyecto destino: ${envelope.project_id}`);
  if (envelope?.created_at) lines.push(`Creado en origen: ${envelope.created_at}`);

  if (payload?.sku_id) lines.push(`SKU: ${payload.sku_id}`);
  if (payload?.product_name) lines.push(`Producto: ${payload.product_name}`);
  if (payload?.category) lines.push(`Categoria: ${payload.category}`);
  if (payload?.quantity != null) lines.push(`Cantidad: ${payload.quantity}`);
  if (payload?.unit) lines.push(`Unidad: ${payload.unit}`);
  if (payload?.unit_price != null) lines.push(`Precio unitario: ${payload.unit_price}`);
  if (payload?.location_id) lines.push(`Ubicacion: ${payload.location_id}`);
  if (payload?.location_name) lines.push(`Nombre ubicacion: ${payload.location_name}`);
  if (payload?.location_type) lines.push(`Tipo ubicacion: ${payload.location_type}`);
  if (payload?.city) lines.push(`Ciudad: ${payload.city}`);

  if (payload?.movement_id) lines.push(`Movimiento: ${payload.movement_id}`);
  if (payload?.order_id) lines.push(`Orden: ${payload.order_id}`);
  if (payload?.reservation_id != null) {
    lines.push(`Reserva: ${payload.reservation_id}`);
  }
  if (payload?.reason) lines.push(`Motivo liberacion: ${payload.reason}`);

  if (payload?.current_stock != null) {
    lines.push(`Stock actual: ${payload.current_stock}`);
  }
  if (payload?.threshold_limite != null) {
    lines.push(`Umbral limite: ${payload.threshold_limite}`);
  }
  if (payload?.alert_id) lines.push(`Alerta origen: ${payload.alert_id}`);

  return lines.join(' | ');
}
