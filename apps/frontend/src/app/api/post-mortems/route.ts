import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';

// GET - Listar post-mortems (con filtros opcionales)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const searchParams = request.nextUrl.searchParams;
    const incidentId = searchParams.get('incidentId');
    const estado = searchParams.get('estado');

    let url = `${BACKEND_URL.replace(/\/$/, '')}/post-mortems`;
    const params = new URLSearchParams();
    if (incidentId) params.append('incidentId', incidentId);
    if (estado) params.append('estado', estado);
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.error('[GET /api/post-mortems] Error:', res.status);
      return NextResponse.json(
        { error: 'Error al obtener post-mortems' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[GET /api/post-mortems] Error:', error);
    return NextResponse.json(
      { error: 'Error de conexión con el backend' },
      { status: 502 }
    );
  }
}

// POST - Crear un nuevo post-mortem
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('Authorization');

    // Validar campos obligatorios
    if (!body.incidentId) {
      return NextResponse.json(
        { error: 'incidentId es requerido' },
        { status: 400 }
      );
    }
    if (!body.titulo) {
      return NextResponse.json(
        { error: 'titulo es requerido' },
        { status: 400 }
      );
    }
    if (!body.causaRaiz) {
      return NextResponse.json(
        { error: 'causaRaiz es requerido' },
        { status: 400 }
      );
    }

    // Preparar payload para el backend
    const payload = {
      incidentId: body.incidentId,
      titulo: body.titulo,
      causaRaiz: body.causaRaiz,
      descripcion: body.descripcion || '',
      duracionMinutos: body.duracionMinutos || 0,
      usuariosAfectados: body.usuariosAfectados || 0,
      sistemasAfectados: body.sistemasAfectados || [],
      aciertos: body.aciertos || [],
      errores: body.errores || [],
      lecciones: body.lecciones || [],
      acciones: body.acciones || [],
      estado: body.estado || 'BORRADOR',
      creadoPor: body.creadoPor || 'system',
    };

    const res = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/post-mortems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[POST /api/post-mortems] Error:', res.status, errorText);
      return NextResponse.json(
        { error: 'Error al crear post-mortem', detail: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[POST /api/post-mortems] Error:', error);
    return NextResponse.json(
      { error: 'Error de conexión con el backend' },
      { status: 502 }
    );
  }
}