import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';

// ─── GET /api/incidents/:id/comentarios ──────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!BACKEND_URL) {
    // Sin backend configurado devolvemos lista vacía (modo mock).
    return NextResponse.json([], { status: 200 });
  }

  try {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes/${encodeURIComponent(id)}/comentarios`;
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
    console.error(`[GET /api/incidents/${id}/comentarios] Error:`, err);
    return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
  }
}

// ─── POST /api/incidents/:id/comentarios ─────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { contenido?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const contenido = (body.contenido || '').trim();
  if (!contenido) {
    return NextResponse.json({ error: 'contenido_requerido' }, { status: 400 });
  }

  if (!BACKEND_URL) {
    return NextResponse.json({ error: 'backend_not_configured' }, { status: 502 });
  }

  try {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes/${encodeURIComponent(id)}/comentarios`;
    const authHeader = request.headers.get('Authorization');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ contenido }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: 'backend_error', status: res.status, detail },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[POST /api/incidents/${id}/comentarios] Error:`, err);
    return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
  }
}
