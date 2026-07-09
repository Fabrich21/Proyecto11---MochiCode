import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';

// ─── GET /api/incidents/:id/playbook ─────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!BACKEND_URL) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes/${encodeURIComponent(id)}/playbook`;
    const authHeader = request.headers.get('Authorization');

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: 'backend_error', status: res.status, detail },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error(`[GET /api/incidents/${id}/playbook] Error:`, err);
    return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
  }
}
