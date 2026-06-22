import { NextResponse } from 'next/server';
import { getIncident, updateIncident } from '../../_incidentsStore';

const BACKEND_URL = process.env.BACKEND_URL || '';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes/${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) {
      // Si el backend no tiene el endpoint GET /id, regresamos not_found
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const record = getIncident(id);
  if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes/${encodeURIComponent(id)}/estado`;
    
    // El frontend envía { incidentStatus: '...' }, el backend espera { estado: '...', usuario_id: '...' }
    let patch;
    try {
      patch = await request.json();
    } catch {
      patch = {};
    }
    
    const backendPayload = {
      estado: patch.incidentStatus || 'ABIERTO',
      usuario_id: '00000000-0000-0000-0000-000000000001' // UUID temporal del sistema
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(backendPayload),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  try {
    const patch = await request.json();
    const updated = updateIncident(id, patch);
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
}
