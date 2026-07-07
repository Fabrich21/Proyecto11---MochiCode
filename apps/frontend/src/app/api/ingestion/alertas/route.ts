import { NextResponse } from 'next/server';
import { createIncident } from '../../_incidentsStore';

const BACKEND_URL = process.env.BACKEND_URL || '';

function normalizeSystemId(systemId?: string) {
  const value = (systemId || '').trim().toUpperCase();
  const match = value.match(/^P(\d+)$/);

  if (!match) {
    return value;
  }

  return `P${match[1].padStart(2, '0')}`;
}

function getApiKeyForSystem(systemId?: string) {
  const normalizedSystemId = normalizeSystemId(systemId);
  if (!normalizedSystemId) {
    return '';
  }

  const envKeyName = `API_KEY_${normalizedSystemId}`;
  return process.env[envKeyName] || '';
}

export async function POST(request: Request) {
  if (BACKEND_URL) {
    const payload = await request.json();
    const sistemaId = normalizeSystemId(payload.sistema_id || payload.system || payload.sistemaId);
    const apiKey = getApiKeyForSystem(sistemaId);

    if (!apiKey) {
      return NextResponse.json({ error: 'missing_api_key', sistemaId }, { status: 400 });
    }

    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/alertas`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        sistema_id: sistemaId,
        creado_en: payload.creado_en || new Date().toISOString(),
        payload: payload.payload || payload,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: 'backend_error', status: res.status, detail: errorText },
        { status: res.status },
      );
    }

    return NextResponse.json({ accepted: true }, { status: res.status });
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
