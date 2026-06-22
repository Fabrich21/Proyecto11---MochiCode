import { NextResponse } from 'next/server';
import { createIncident } from '../../_incidentsStore';

const BACKEND_URL = process.env.BACKEND_URL || '';

export async function POST(request: Request) {
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/alertas`;
    const body = await request.text();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'content-type': request.headers.get('content-type') || 'application/json',
        'x-api-key': process.env.API_KEY_P08 || 'auth_p08_secret' // Llave requerida por ZeroTrustGuard
      },
      body,
    });
    const data = await res.text();
    return new NextResponse(data, { status: res.status });
  }

  try {
    const payload = await request.json();

    // Map minimal create alert to an incident in-memory for local demo.
    const record = createIncident({
      system: payload.sistema_id || payload.system || 'unknown',
      severity: 'medium',
      description: JSON.stringify(payload.payload || payload),
      affectedUsers: undefined,
      affectedProject: payload.sistema_id || undefined,
      incidentStatus: 'ABIERTO' as any,
    });

    return NextResponse.json({ accepted: true, incident: record }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
}
