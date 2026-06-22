import { NextResponse } from 'next/server';
import { listIncidents, createIncident } from '../_incidentsStore';

const BACKEND_URL = process.env.BACKEND_URL || '';

export async function GET() {
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes`;
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const data = listIncidents();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes`;
    const body = await request.text();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') || 'application/json' },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  try {
    const body = await request.json();
    const created = createIncident(body);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
}
