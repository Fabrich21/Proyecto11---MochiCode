import { NextResponse } from 'next/server';
import { listIncidents, createIncident } from '../_incidentsStore';

const BACKEND_URL = process.env.BACKEND_URL || '';

function mapBackendToFrontend(inc: any) {
  const prioridad = (inc.prioridad ?? 'MEDIA').toUpperCase();
  const severity: 'critical' | 'high' | 'medium' =
    prioridad === 'CRITICA' || prioridad === 'CRITICAL'
      ? 'critical'
      : prioridad === 'ALTA' || prioridad === 'HIGH'
      ? 'high'
      : 'medium';

  return {
    id: inc.id,
    system: inc.sistemaId ?? inc.system ?? 'unknown',
    description: inc.descripcion ?? inc.titulo ?? '',
    severity,
    incidentStatus: inc.estado ?? 'ABIERTO',
    createdAt: inc.creadoEn ?? inc.createdAt ?? new Date().toISOString(),
    slaRemaining: inc.slaRemaining ?? 0,
    slaPercentage: inc.slaPercentage ?? 0,
    affectedProject: inc.sistemaId ?? inc.affectedProject ?? null,
    affectedUsers: inc.affectedUsers ?? null,
    acknowledgedAt: inc.acknowledgedAt ?? null,
    resolvedAt: inc.fechaResolucion ?? inc.resolvedAt ?? null,
    closedAt:
      inc.estado === 'CERRADO'
        ? (inc.fechaResolucion ?? new Date().toISOString())
        : (inc.closedAt ?? null),
    slaTargetMinutes: inc.slaTargetMinutes ?? null,
  };
}

// ─── GET /api/incidents ──────────────────────────────────────────────────────
export async function GET() {
  if (BACKEND_URL) {
    try {
      const url = `${BACKEND_URL.replace(/\/$/, '')}/incidentes`;
      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) {
        return NextResponse.json(
          { error: 'backend_error', status: res.status },
          { status: res.status },
        );
      }

      const json = await res.json();
      // El backend envuelve la respuesta: { data: [...], meta: {...} }
      const items: any[] = Array.isArray(json) ? json : (json.data ?? []);

      return NextResponse.json(items.map(mapBackendToFrontend));
    } catch (err) {
      console.error('[GET /api/incidents] Error conectando al backend:', err);
      return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
    }
  }

  // Fallback mock
  return NextResponse.json(listIncidents());
}

// ─── POST /api/incidents ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  if (BACKEND_URL) {
    try {
      const url = `${BACKEND_URL.replace(/\/$/, '')}/incidentes`;
      const body = await request.text();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      const data = await res.json();
      return NextResponse.json(mapBackendToFrontend(data), { status: res.status });
    } catch (err) {
      console.error('[POST /api/incidents] Error:', err);
      return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
    }
  }

  try {
    const body = await request.json();
    const created = createIncident(body);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
}