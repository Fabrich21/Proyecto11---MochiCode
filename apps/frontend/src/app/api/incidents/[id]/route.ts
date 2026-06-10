import { NextResponse } from 'next/server';
import { getIncident, updateIncident } from '../../_incidentsStore';

const BACKEND_URL = process.env.BACKEND_URL || '';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/incidents/${encodeURIComponent(id)}`;
    const res = await fetch(url);
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
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/incidents/${encodeURIComponent(id)}`;
    const body = await request.text();
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': request.headers.get('content-type') || 'application/json' },
      body,
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
