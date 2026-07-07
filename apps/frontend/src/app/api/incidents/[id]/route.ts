import { NextResponse } from 'next/server';
import { getIncident, updateIncident } from '../../_incidentsStore';

const BACKEND_URL = process.env.BACKEND_URL || '';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes/${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const record = getIncident(id);
  if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(record);
}

// Mapea los valores del frontend (IncidenteEstado) al enum que espera el backend
const ESTADO_MAP: Record<string, string> = {
  ABIERTO: 'ABIERTO',
  EN_PROGRESO: 'EN_PROGRESO',
  CERRADO: 'CERRADO',
};

//PATCH para actualizar el estado de un incidente (reconocer, resolver, cerrar)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: any;
 
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
 
  if (BACKEND_URL) {
    try {
      // El backend espera PATCH /api/v1/incidentes/:id/estado con { estado, usuarioId }
      const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes/${encodeURIComponent(id)}/estado`;
 
      // Determina el estado nuevo a partir del payload del dashboard
      const estadoNuevo =
        ESTADO_MAP[body.incidentStatus] ??
        (body.resolvedAt || body.closedAt ? 'CERRADO' : 'EN_PROGRESO');
 
      const authHeader = request.headers.get('Authorization');
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 
          'content-type': 'application/json',
          ...(authHeader ? { 'Authorization': authHeader } : {})
        },
        body: JSON.stringify({
          estado: estadoNuevo,
        }),
      });
 
      if (!res.ok) {
        const err = await res.text();
        console.error(`[PATCH /api/incidents/${id}] Backend respondió ${res.status}:`, err);
        return NextResponse.json({ error: 'backend_error' }, { status: res.status });
      }
 
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    } catch (err) {
      console.error(`[PATCH /api/incidents/${id}] Error de red:`, err);
      return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
    }
  }
 
  // Fallback mock — actualiza el store en memoria
  const updated = updateIncident(id, {
    incidentStatus: body.incidentStatus,
    acknowledgedAt: body.acknowledgedAt,
    resolvedAt: body.resolvedAt,
    closedAt: body.closedAt,
  });
 
  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
 
  return NextResponse.json(updated, { status: 200 });
}
 