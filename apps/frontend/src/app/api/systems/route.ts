import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';

function mapBackendToFrontend(system: any) {
  return {
    id: system.id ?? system.sistemaId ?? system.sistema_id,
    nombre: system.nombre ?? system.name ?? system.id ?? 'Sin nombre',
    descripcion: system.descripcion ?? null,
  };
}

export async function GET() {
  if (!BACKEND_URL) {
    return NextResponse.json({ data: [] });
  }

  try {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/sistemas`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'backend_error', status: res.status },
        { status: res.status },
      );
    }

    const json = await res.json();
    const items: any[] = Array.isArray(json) ? json : (json.data ?? []);

    return NextResponse.json(items.map(mapBackendToFrontend));
  } catch (err) {
    console.error('[GET /api/systems] Error conectando al backend:', err);
    return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
  }
}