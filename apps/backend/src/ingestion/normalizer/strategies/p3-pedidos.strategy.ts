import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { NormalizedAlerta } from '../../dto/normalized-alerta.dto';

type OrdersEventType =
  | 'pedido_creado'
  | 'stock_reservado'
  | 'pedido_pagado'
  | 'pago_fallido'
  | 'listo_para_despacho'
  | 'pedido_en_transito'
  | 'pedido_entregado'
  | 'stock_agotado';

interface OrdersPayload {
  order_id: string | number;
  customer_id: string | number;
  sales_channel?: string;
  total_amount?: number;
  total_items?: number;
}

interface OrdersEnvelope {
  source?: string;
  event_type?: OrdersEventType;
  payload?: OrdersPayload;
}

const EVENT_LABELS: Record<OrdersEventType, string> = {
  pedido_creado: 'Pedido creado',
  stock_reservado: 'Stock reservado',
  pedido_pagado: 'Pedido pagado',
  pago_fallido: 'Pago fallido',
  listo_para_despacho: 'Pedido listo para despacho',
  pedido_en_transito: 'Pedido en transito',
  pedido_entregado: 'Pedido entregado',
  stock_agotado: 'Stock agotado',
};

export function normalizeP3Pedidos(dto: CreateAlertaDto): NormalizedAlerta {
  const envelope = dto.payload as OrdersEnvelope;
  const eventType = envelope?.event_type;
  const payload = envelope?.payload;

  const prioridad = inferPriority(eventType);
  const estadoSugerido = inferState(eventType);
  const externalId = payload?.order_id != null ? String(payload.order_id) : undefined;

  return {
    titulo: buildTitulo(eventType, payload),
    descripcion: buildDescripcion(envelope, payload),
    prioridad,
    estadoSugerido,
    externalId,
  };
}

function inferPriority(eventType?: OrdersEventType): NormalizedAlerta['prioridad'] {
  switch (eventType) {
    case 'pago_fallido':
    case 'stock_agotado':
      return 'CRITICA';
    case 'stock_reservado':
    case 'listo_para_despacho':
    case 'pedido_en_transito':
      return 'MEDIA';
    case 'pedido_creado':
    case 'pedido_pagado':
    case 'pedido_entregado':
      return 'BAJA';
    default:
      return 'MEDIA';
  }
}

function inferState(eventType?: OrdersEventType): IncidenteEstado {
  if (eventType === 'pedido_entregado') {
    return IncidenteEstado.CERRADO;
  }

  if (eventType === 'pago_fallido' || eventType === 'stock_agotado') {
    return IncidenteEstado.EN_PROGRESO;
  }

  return IncidenteEstado.ABIERTO;
}

function buildTitulo(eventType?: OrdersEventType, payload?: OrdersPayload): string {
  const base = eventType ? EVENT_LABELS[eventType] : 'Evento de pedidos';
  const order = payload?.order_id != null ? ` | Pedido ${payload.order_id}` : '';
  return `[P3 Pedidos] ${base}${order}`;
}

function buildDescripcion(
  envelope?: OrdersEnvelope,
  payload?: OrdersPayload,
): string {
  const lines: string[] = [];

  if (envelope?.source) lines.push(`Origen: ${envelope.source}`);
  if (envelope?.event_type) lines.push(`Tipo: ${envelope.event_type}`);
  if (payload?.order_id != null) lines.push(`Pedido: ${payload.order_id}`);
  if (payload?.customer_id != null) lines.push(`Cliente: ${payload.customer_id}`);
  if (payload?.sales_channel) lines.push(`Canal: ${payload.sales_channel}`);
  if (payload?.total_amount != null) lines.push(`Monto total: ${payload.total_amount}`);
  if (payload?.total_items != null) lines.push(`Total items: ${payload.total_items}`);

  return lines.join(' | ');
}
